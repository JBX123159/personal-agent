import type {
  AgentDecision,
  Memory,
  ToolName,
  VehicleContext,
} from "@/domain/agent";
import type {
  AgentDecisionRequest,
  AgentPlanStep,
  ProposedToolCall,
  StructuredAgentDecision,
} from "@/domain/structured-agent";
const TOOL_NAMES = [
  "getVehicleState",
  "setClimateTemperature",
  "setNavigation",
  "searchEnergyStation",
  "searchRestaurant",
] as const satisfies readonly ToolName[];
const TOOL_NAME_SCHEMA = { type: "string", enum: TOOL_NAMES } as const;
const TOOL_ARGUMENT_SCHEMA = {
  type: "object",
  additionalProperties: false,
  description:
    "getVehicleState、searchEnergyStation、searchRestaurant 必须使用空对象 {}；setClimateTemperature 仅使用 temperature；setNavigation 仅使用 destination。",
  properties: {
    temperature: {
      type: "number",
      minimum: -20,
      maximum: 60,
      description: "仅 setClimateTemperature 使用。",
    },
    destination: {
      type: "string",
      minLength: 1,
      maxLength: 120,
      description: "仅 setNavigation 使用。",
    },
  },
} as const;
const EXPECTED_STATE_CHANGE_SCHEMA = {
  ...TOOL_ARGUMENT_SCHEMA,
  description:
    "仅写操作提供预期状态：空调只使用 temperature，导航只使用 destination。",
} as const;
export const AGENT_DECISION_TOOL = {
  type: "function",
  function: {
    name: "submit_agent_decision",
    description: "提交结构化 Agent 决策；此函数不会直接执行车辆工具。",
    parameters: {
      type: "object",
      additionalProperties: false,
      required: [
        "schemaVersion",
        "intent",
        "confidence",
        "goal",
        "plan",
        "memoryReferences",
        "proposedToolCalls",
        "clarificationNeeded",
        "requiresConfirmation",
        "responseDraft",
      ],
      properties: {
        schemaVersion: { type: "string", enum: ["1.0"] },
        intent: { type: "string", minLength: 1, maxLength: 80 },
        confidence: { type: "number", minimum: 0, maximum: 1 },
        goal: { type: "string", minLength: 1, maxLength: 240 },
        plan: {
          type: "array",
          minItems: 0,
          maxItems: 8,
          items: {
            type: "object",
            additionalProperties: false,
            required: ["stepId", "description"],
            properties: {
              stepId: { type: "string", minLength: 1, maxLength: 40 },
              description: { type: "string", minLength: 1, maxLength: 160 },
              toolName: TOOL_NAME_SCHEMA,
            },
          },
        },
        memoryReferences: {
          type: "array",
          maxItems: 5,
          items: { type: "string", minLength: 1, maxLength: 80 },
        },
        proposedToolCalls: {
          type: "array",
          maxItems: 5,
          items: {
            type: "object",
            additionalProperties: false,
            required: ["callId", "toolName", "arguments"],
            properties: {
              callId: { type: "string", minLength: 1, maxLength: 40 },
              toolName: TOOL_NAME_SCHEMA,
              arguments: TOOL_ARGUMENT_SCHEMA,
              expectedStateChange: EXPECTED_STATE_CHANGE_SCHEMA,
            },
          },
        },
        clarificationNeeded: { type: "boolean" },
        requiresConfirmation: { type: "boolean" },
        confirmationPrompt: { type: "string", maxLength: 300 },
        responseDraft: { type: "string", minLength: 1, maxLength: 500 },
      },
    },
  },
} as const;
type UnknownRecord = Record<string, unknown>;
function readObject(value: unknown, path: string): UnknownRecord {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`${path} 必须是对象。`);
  }
  return value as UnknownRecord;
}
function checkKeys(
  value: UnknownRecord,
  allowed: readonly string[],
  required: readonly string[],
  path: string,
) {
  const unknown = Object.keys(value).find((key) => !allowed.includes(key));
  if (unknown) throw new Error(`${path} 包含未知字段 ${unknown}。`);
  const missing = required.find((key) => !(key in value));
  if (missing) throw new Error(`${path}.${missing} 是必填字段。`);
}
function readString(value: unknown, path: string, min: number, max: number) {
  if (typeof value !== "string" || value.length < min || value.length > max) {
    throw new Error(`${path} 必须是 ${min} 到 ${max} 个字符的字符串。`);
  }
  return value;
}
function readNumber(value: unknown, path: string, min: number, max: number) {
  if (typeof value !== "number" || !Number.isFinite(value) || value < min || value > max) {
    throw new Error(`${path} 必须是 ${min} 到 ${max} 之间的有限数字。`);
  }
  return value;
}
function readBoolean(value: unknown, path: string) {
  if (typeof value !== "boolean") throw new Error(`${path} 必须是布尔值。`);
  return value;
}
function readArray(value: unknown, path: string, max: number) {
  if (!Array.isArray(value) || value.length > max) {
    throw new Error(`${path} 必须是最多包含 ${max} 项的数组。`);
  }
  return value;
}
function readEnum<T extends string>(value: unknown, values: readonly T[], path: string): T {
  if (typeof value !== "string" || !values.includes(value as T)) {
    throw new Error(`${path} 不是允许的值。`);
  }
  return value as T;
}
function rejectDuplicates(values: string[], path: string) {
  if (new Set(values).size !== values.length) throw new Error(`${path} 不允许重复值。`);
}
function parseToolName(value: unknown, path: string): ToolName {
  if (typeof value !== "string" || !TOOL_NAMES.includes(value as ToolName)) {
    throw new Error(`${path} 引用了未知 Tool：${String(value)}。`);
  }
  return value as ToolName;
}
function parseToolState(
  toolName: ToolName,
  value: unknown,
  path: string,
): Record<string, unknown> {
  const object = readObject(value, path);
  if (toolName === "setClimateTemperature") {
    checkKeys(object, ["temperature"], ["temperature"], path);
    return { temperature: readNumber(object.temperature, `${path}.temperature`, -20, 60) };
  }
  if (toolName === "setNavigation") {
    checkKeys(object, ["destination"], ["destination"], path);
    return { destination: readString(object.destination, `${path}.destination`, 1, 120) };
  }
  const unknown = Object.keys(object)[0];
  if (unknown) throw new Error(`${path} 包含未知参数 ${unknown}。`);
  return {};
}
function parsePlan(value: unknown): AgentPlanStep[] {
  const plan = readArray(value, "AgentDecision.plan", 8).map((item, index) => {
    const path = `AgentDecision.plan[${index}]`;
    const object = readObject(item, path);
    checkKeys(object, ["stepId", "description", "toolName"], ["stepId", "description"], path);
    const toolName = object.toolName === undefined ? undefined : parseToolName(object.toolName, `${path}.toolName`);
    return {
      stepId: readString(object.stepId, `${path}.stepId`, 1, 40),
      description: readString(object.description, `${path}.description`, 1, 160),
      ...(toolName ? { toolName } : {}),
    };
  });
  rejectDuplicates(plan.map((item) => item.stepId), "AgentDecision.plan.stepId");
  return plan;
}
function parseToolCalls(value: unknown): ProposedToolCall[] {
  const calls = readArray(value, "AgentDecision.proposedToolCalls", 5).map((item, index) => {
    const path = `AgentDecision.proposedToolCalls[${index}]`;
    const object = readObject(item, path);
    checkKeys(object, ["callId", "toolName", "arguments", "expectedStateChange"], ["callId", "toolName", "arguments"], path);
    const toolName = parseToolName(object.toolName, `${path}.toolName`);
    const expectedStateChange = object.expectedStateChange === undefined
      ? undefined
      : parseToolState(toolName, object.expectedStateChange, `${path}.expectedStateChange`);
    return {
      callId: readString(object.callId, `${path}.callId`, 1, 40),
      toolName,
      arguments: parseToolState(toolName, object.arguments, `${path}.arguments`),
      ...(expectedStateChange ? { expectedStateChange } : {}),
    };
  });
  rejectDuplicates(calls.map((item) => item.callId), "AgentDecision.proposedToolCalls.callId");
  return calls;
}
export function parseAgentDecision(
  value: unknown,
  allowedMemoryIds: ReadonlySet<string>,
): StructuredAgentDecision {
  const object = readObject(value, "AgentDecision");
  const required = ["schemaVersion", "intent", "confidence", "goal", "plan", "memoryReferences", "proposedToolCalls", "clarificationNeeded", "requiresConfirmation", "responseDraft"];
  checkKeys(object, [...required, "confirmationPrompt"], required, "AgentDecision");
  if (object.schemaVersion !== "1.0") throw new Error("AgentDecision.schemaVersion 必须是 1.0。");
  const memoryReferences = readArray(object.memoryReferences, "AgentDecision.memoryReferences", 5)
    .map((item, index) => readString(item, `AgentDecision.memoryReferences[${index}]`, 1, 80));
  rejectDuplicates(memoryReferences, "AgentDecision.memoryReferences");
  for (const id of memoryReferences) {
    if (!allowedMemoryIds.has(id)) throw new Error(`Memory 引用不在允许列表：${id}。`);
  }
  const confirmationPrompt = object.confirmationPrompt === undefined
    ? undefined
    : readString(object.confirmationPrompt, "AgentDecision.confirmationPrompt", 0, 300);
  return {
    schemaVersion: "1.0",
    intent: readString(object.intent, "AgentDecision.intent", 1, 80),
    confidence: readNumber(object.confidence, "AgentDecision.confidence", 0, 1),
    goal: readString(object.goal, "AgentDecision.goal", 1, 240),
    plan: parsePlan(object.plan),
    memoryReferences,
    proposedToolCalls: parseToolCalls(object.proposedToolCalls),
    clarificationNeeded: readBoolean(object.clarificationNeeded, "AgentDecision.clarificationNeeded"),
    requiresConfirmation: readBoolean(object.requiresConfirmation, "AgentDecision.requiresConfirmation"),
    ...(confirmationPrompt !== undefined ? { confirmationPrompt } : {}),
    responseDraft: readString(object.responseDraft, "AgentDecision.responseDraft", 1, 500),
  };
}
function parseVehicleContext(value: unknown): VehicleContext {
  const object = readObject(value, "DecisionRequest.context");
  const required = ["currentTime", "location", "batteryLevel", "passengerMode", "cabinTemperature", "weather"];
  checkKeys(object, [...required, "currentRoute"], required, "DecisionRequest.context");
  const currentRoute = object.currentRoute === undefined ? undefined : readString(object.currentRoute, "DecisionRequest.context.currentRoute", 0, 200);
  return {
    currentTime: readString(object.currentTime, "DecisionRequest.context.currentTime", 1, 80),
    location: readString(object.location, "DecisionRequest.context.location", 1, 160),
    batteryLevel: readNumber(object.batteryLevel, "DecisionRequest.context.batteryLevel", 0, 100),
    passengerMode: readEnum(object.passengerMode, ["owner_only", "guest"], "DecisionRequest.context.passengerMode"),
    cabinTemperature: readNumber(object.cabinTemperature, "DecisionRequest.context.cabinTemperature", -50, 100),
    weather: readString(object.weather, "DecisionRequest.context.weather", 1, 160),
    ...(currentRoute !== undefined ? { currentRoute } : {}),
  };
}
function parseMemory(value: unknown, index: number): Memory {
  const path = `DecisionRequest.memories[${index}]`;
  const object = readObject(value, path);
  const required = ["id", "type", "content", "confidence", "sensitivity", "source", "status", "userConfirmed", "observationCount"];
  checkKeys(object, [...required, "context"], required, path);
  const context = object.context === undefined ? undefined : readObject(object.context, `${path}.context`);
  const observationCount = readNumber(
    object.observationCount,
    `${path}.observationCount`,
    0,
    1000,
  );
  if (!Number.isInteger(observationCount)) {
    throw new Error(`${path}.observationCount 必须是整数。`);
  }
  return {
    id: readString(object.id, `${path}.id`, 1, 80),
    type: readEnum(object.type, ["preference", "routine", "temporary"], `${path}.type`),
    content: readString(object.content, `${path}.content`, 1, 500),
    ...(context ? { context } : {}),
    confidence: readNumber(object.confidence, `${path}.confidence`, 0, 1),
    sensitivity: readEnum(object.sensitivity, ["low", "medium", "high"], `${path}.sensitivity`),
    source: readEnum(object.source, ["explicit", "repeated_behavior", "agent_inference"], `${path}.source`),
    status: readEnum(object.status, ["temporary", "candidate", "active", "suspended", "deleted"], `${path}.status`),
    userConfirmed: readBoolean(object.userConfirmed, `${path}.userConfirmed`),
    observationCount,
  };
}
export function parseAgentDecisionRequest(value: unknown): AgentDecisionRequest {
  const object = readObject(value, "DecisionRequest");
  checkKeys(object, ["userInput", "context", "memories"], ["userInput", "context", "memories"], "DecisionRequest");
  const memories = readArray(object.memories, "DecisionRequest.memories", 20)
    .map((item, index) => parseMemory(item, index));
  rejectDuplicates(memories.map((item) => item.id), "DecisionRequest.memories.id");
  return {
    userInput: readString(object.userInput, "DecisionRequest.userInput", 1, 500),
    context: parseVehicleContext(object.context),
    memories,
  };
}

export function validateAgentDecision(value: unknown): value is AgentDecision {
  if (!value || typeof value !== "object") return false;

  const decision = value as Partial<AgentDecision>;
  const validPlan =
    Array.isArray(decision.plan) &&
    decision.plan.every(
      (step) =>
        typeof step?.action === "string" &&
        ["read", "low", "high"].includes(step.risk),
    );

  return (
    typeof decision.intent === "string" &&
    typeof decision.confidence === "number" &&
    decision.confidence >= 0 &&
    decision.confidence <= 1 &&
    Array.isArray(decision.relevantMemoryIds) &&
    decision.relevantMemoryIds.every((id) => typeof id === "string") &&
    typeof decision.goal === "string" &&
    validPlan &&
    typeof decision.clarificationNeeded === "boolean" &&
    typeof decision.confirmationRequired === "boolean" &&
    typeof decision.response === "string"
  );
}
