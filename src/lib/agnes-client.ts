import type { AgentDecisionRequest } from "@/domain/structured-agent";
import type { StructuredAgentDecision } from "@/domain/structured-agent";
import {
  AGENT_DECISION_TOOL,
  parseAgentDecision,
} from "@/lib/agent-decision-schema";

const AGNES_DECISION_URL =
  "https://apihub.agnes-ai.com/v1/chat/completions";
const AGNES_MODEL = "agnes-2.5-flash";
const DEFAULT_TIMEOUT_MS = 20_000;

interface AgnesClientOptions {
  apiKey?: string;
  fetchFn?: typeof fetch;
  timeoutMs?: number;
}

export type AgnesErrorCode =
  | "NOT_CONFIGURED"
  | "TIMEOUT"
  | "UPSTREAM_ERROR"
  | "INVALID_RESPONSE";

export class AgnesClientError extends Error {
  constructor(
    public readonly code: AgnesErrorCode,
    message: string,
    public readonly status?: number,
  ) {
    super(message);
    this.name = "AgnesClientError";
  }
}

function createSystemMessage() {
  return {
    role: "system",
    content: [
      "你是车载 Personal Agent 的决策模块，只负责提出决策，不执行任何工具。",
      "必须调用 submit_agent_decision，并严格遵守该函数的参数结构。",
      "只能引用请求中提供的 Memory ID；没有足够信息时应请求澄清。",
      "可用工具：getVehicleState 读取车辆状态；setClimateTemperature 设置温度；setNavigation 设置导航；searchEnergyStation 查询补能站；searchRestaurant 查询餐厅。",
      'Tool 参数契约：getVehicleState: arguments={}；searchEnergyStation: arguments={}；searchRestaurant: arguments={}；setClimateTemperature: arguments={"temperature":number}；setNavigation: arguments={"destination":"string"}。',
      "vehicleContext.location 已在请求上下文中提供，查询工具不得添加 location、query 等未定义参数；expectedStateChange 仅用于写操作，并与对应 arguments 使用相同字段和值。",
      "responseDraft 只能描述执行前计划，不得声称工具已经成功。",
      "程序权限引擎会独立裁决所有工具请求，模型不得尝试绕过确认或权限规则。",
    ].join("\n"),
  };
}

function createUserMessage(request: AgentDecisionRequest) {
  return {
    role: "user",
    content: JSON.stringify({
      userInput: request.userInput,
      vehicleContext: request.context,
      activeConfirmedMemories: request.memories,
    }),
  };
}

function filterEligibleMemories(request: AgentDecisionRequest) {
  return request.memories.filter(
    (memory) => memory.status === "active" && memory.userConfirmed,
  );
}

function createUpstreamError(status: number) {
  if (status === 401) {
    return new AgnesClientError(
      "UPSTREAM_ERROR",
      "Agnes 认证失败，请检查服务端 API Key。",
      status,
    );
  }
  if (status === 429) {
    return new AgnesClientError(
      "UPSTREAM_ERROR",
      "Agnes 请求过于频繁，请稍后重试。",
      status,
    );
  }
  if (status >= 500) {
    return new AgnesClientError(
      "UPSTREAM_ERROR",
      "Agnes 服务暂时不可用，请稍后重试。",
      status,
    );
  }
  return new AgnesClientError(
    "UPSTREAM_ERROR",
    `Agnes 请求失败（状态码 ${status}）。`,
    status,
  );
}

function readFunctionArguments(payload: unknown): string {
  if (!payload || typeof payload !== "object") {
    throw new AgnesClientError(
      "INVALID_RESPONSE",
      "Agnes 返回了无效响应。",
    );
  }

  const choices = (payload as { choices?: unknown }).choices;
  if (!Array.isArray(choices)) {
    throw new AgnesClientError(
      "INVALID_RESPONSE",
      "Agnes 返回了无效响应。",
    );
  }

  for (const choice of choices) {
    if (!choice || typeof choice !== "object") continue;
    const message = (choice as { message?: unknown }).message;
    if (!message || typeof message !== "object") continue;
    const toolCalls = (message as { tool_calls?: unknown }).tool_calls;
    if (!Array.isArray(toolCalls)) continue;

    for (const toolCall of toolCalls) {
      if (!toolCall || typeof toolCall !== "object") continue;
      const functionCall = (toolCall as { function?: unknown }).function;
      if (!functionCall || typeof functionCall !== "object") continue;
      const name = (functionCall as { name?: unknown }).name;
      const argumentsValue = (functionCall as { arguments?: unknown })
        .arguments;
      if (
        name === "submit_agent_decision" &&
        typeof argumentsValue === "string"
      ) {
        return argumentsValue;
      }
    }
  }

  throw new AgnesClientError(
    "INVALID_RESPONSE",
    "Agnes 未返回 submit_agent_decision 函数调用。",
  );
}

export async function requestAgnesDecision(
  request: AgentDecisionRequest,
  options: AgnesClientOptions = {},
): Promise<StructuredAgentDecision> {
  const apiKey = (options.apiKey ?? process.env.AGNES_API_KEY ?? "").trim();
  if (!apiKey) {
    throw new AgnesClientError(
      "NOT_CONFIGURED",
      "尚未配置 Agnes API Key，请在 .env.local 中设置 AGNES_API_KEY。",
    );
  }

  const fetchFn = options.fetchFn ?? fetch;
  const timeoutMs =
    options.timeoutMs !== undefined &&
    Number.isFinite(options.timeoutMs) &&
    options.timeoutMs > 0
      ? options.timeoutMs
      : DEFAULT_TIMEOUT_MS;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  const eligibleMemories = filterEligibleMemories(request);
  const safeRequest = { ...request, memories: eligibleMemories };

  let response: Response;
  try {
    response = await fetchFn(AGNES_DECISION_URL, {
      method: "POST",
      signal: controller.signal,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: AGNES_MODEL,
        temperature: 0.1,
        messages: [createSystemMessage(), createUserMessage(safeRequest)],
        tools: [AGENT_DECISION_TOOL],
        tool_choice: {
          type: "function",
          function: { name: "submit_agent_decision" },
        },
      }),
    });
  } catch {
    if (controller.signal.aborted) {
      throw new AgnesClientError(
        "TIMEOUT",
        "Agnes 请求超过 20 秒，未执行任何工具。",
      );
    }
    throw new AgnesClientError(
      "UPSTREAM_ERROR",
      "无法连接 Agnes 服务，请检查网络后重试。",
    );
  } finally {
    clearTimeout(timeoutId);
  }

  if (!response.ok) {
    throw createUpstreamError(response.status);
  }

  let payload: unknown;
  try {
    payload = await response.json();
  } catch {
    throw new AgnesClientError(
      "INVALID_RESPONSE",
      "Agnes 返回了无法解析的响应。",
    );
  }

  const functionArguments = readFunctionArguments(payload);
  let decisionValue: unknown;
  try {
    decisionValue = JSON.parse(functionArguments);
  } catch {
    throw new AgnesClientError(
      "INVALID_RESPONSE",
      "Agnes 返回的函数参数不是合法 JSON。",
    );
  }

  try {
    return parseAgentDecision(
      decisionValue,
      new Set(eligibleMemories.map((memory) => memory.id)),
    );
  } catch {
    throw new AgnesClientError(
      "INVALID_RESPONSE",
      "Agnes 返回的结构化决策未通过校验。",
    );
  }
}
