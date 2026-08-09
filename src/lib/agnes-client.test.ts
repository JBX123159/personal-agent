import assert from "node:assert/strict";
import test from "node:test";

import { initialVehicleContext, mockMemories } from "../data/mock-data";
import { AgnesClientError, requestAgnesDecision } from "./agnes-client";

const validDecision = {
  schemaVersion: "1.0",
  intent: "clarify",
  confidence: 0.7,
  goal: "确认用户意图",
  plan: [],
  memoryReferences: [],
  proposedToolCalls: [],
  clarificationNeeded: true,
  requiresConfirmation: false,
  responseDraft: "请说明具体安排。",
};

const decisionRequest = {
  userInput: "今晚还是老样子吧",
  context: initialVehicleContext,
  memories: mockMemories,
};

function createAgnesResponse(
  decision: unknown = validDecision,
  functionName = "submit_agent_decision",
) {
  return new Response(
    JSON.stringify({
      choices: [
        {
          message: {
            tool_calls: [
              {
                function: {
                  name: functionName,
                  arguments: JSON.stringify(decision),
                },
              },
            ],
          },
        },
      ],
    }),
    { status: 200 },
  );
}

test("缺少 Agnes Key 时不发送请求", async () => {
  let requestSent = false;
  const fetchFn: typeof fetch = async () => {
    requestSent = true;
    return createAgnesResponse();
  };

  await assert.rejects(
    requestAgnesDecision(decisionRequest, { apiKey: "", fetchFn }),
    (error: unknown) =>
      error instanceof AgnesClientError && error.code === "NOT_CONFIGURED",
  );
  assert.equal(requestSent, false);
});

test("固定 Agnes 地址、模型和 submit_agent_decision 函数调用", async () => {
  let capturedUrl = "";
  let capturedInit: RequestInit | undefined;
  const fetchFn: typeof fetch = async (input, init) => {
    capturedUrl = String(input);
    capturedInit = init;
    return createAgnesResponse();
  };

  const decision = await requestAgnesDecision(decisionRequest, {
    apiKey: "test-key",
    fetchFn,
  });

  assert.equal(decision.intent, "clarify");
  assert.equal(
    capturedUrl,
    "https://apihub.agnes-ai.com/v1/chat/completions",
  );
  assert.equal(capturedInit?.method, "POST");
  const body = JSON.parse(String(capturedInit?.body)) as Record<string, unknown>;
  assert.equal(body.model, "agnes-2.5-flash");
  assert.deepEqual(body.tool_choice, {
    type: "function",
    function: { name: "submit_agent_decision" },
  });
  const messages = body.messages as Array<{ role: string; content: string }>;
  assert.match(
    messages[0].content,
    /searchEnergyStation: arguments=\{\}/,
  );
  assert.match(messages[0].content, /getVehicleState: arguments=\{\}/);
  assert.match(messages[0].content, /searchRestaurant: arguments=\{\}/);
  assert.match(
    messages[0].content,
    /setClimateTemperature: arguments=\{"temperature":number\}/,
  );
  assert.match(
    messages[0].content,
    /setNavigation: arguments=\{"destination":"string"\}/,
  );
  assert.match(messages[0].content, /vehicleContext\.location/);
  assert.match(messages[0].content, /location、query/);
});

test("查询工具只接受明确声明的空参数", async () => {
  const searchDecision = {
    ...validDecision,
    intent: "search_energy_station",
    goal: "查询补能站",
    proposedToolCalls: [
      {
        callId: "search-energy",
        toolName: "searchEnergyStation",
        arguments: {},
      },
    ],
  };
  const validFetch: typeof fetch = async () =>
    createAgnesResponse(searchDecision);

  const decision = await requestAgnesDecision(decisionRequest, {
    apiKey: "test-key",
    fetchFn: validFetch,
  });
  assert.deepEqual(decision.proposedToolCalls[0].arguments, {});

  const invalidFetch: typeof fetch = async () =>
    createAgnesResponse({
      ...searchDecision,
      proposedToolCalls: [
        {
          callId: "search-energy",
          toolName: "searchEnergyStation",
          arguments: { location: "Office" },
        },
      ],
    });
  await assert.rejects(
    requestAgnesDecision(decisionRequest, {
      apiKey: "test-key",
      fetchFn: invalidFetch,
    }),
    (error: unknown) =>
      error instanceof AgnesClientError && error.code === "INVALID_RESPONSE",
  );
});

test("只把已确认且启用的 Memory 发给 Agnes", async () => {
  const memories = [
    mockMemories[0],
    { ...mockMemories[1], status: "candidate" as const, userConfirmed: false },
    { ...mockMemories[2], status: "suspended" as const },
    { ...mockMemories[3], status: "deleted" as const },
  ];
  let capturedBody = "";
  const fetchFn: typeof fetch = async (_input, init) => {
    capturedBody = String(init?.body);
    return createAgnesResponse();
  };

  await requestAgnesDecision(
    { ...decisionRequest, memories },
    { apiKey: "test-key", fetchFn },
  );

  assert.match(capturedBody, new RegExp(mockMemories[0].id));
  assert.doesNotMatch(capturedBody, new RegExp(mockMemories[1].id));
  assert.doesNotMatch(capturedBody, new RegExp(mockMemories[2].id));
  assert.doesNotMatch(capturedBody, new RegExp(mockMemories[3].id));
});

for (const [status, expectedMessage] of [
  [401, /认证失败/],
  [429, /过于频繁/],
  [503, /暂时不可用/],
] as const) {
  test(`清晰映射 Agnes ${status} 响应`, async () => {
    const fetchFn: typeof fetch = async () =>
      new Response("sensitive upstream response", { status });

    await assert.rejects(
      requestAgnesDecision(decisionRequest, {
        apiKey: "test-key",
        fetchFn,
      }),
      (error: unknown) =>
        error instanceof AgnesClientError &&
        error.code === "UPSTREAM_ERROR" &&
        error.status === status &&
        expectedMessage.test(error.message) &&
        !error.message.includes("sensitive upstream response"),
    );
  });
}

test("20 秒超时机制可由测试参数缩短验证", async () => {
  const fetchFn: typeof fetch = async (_input, init) =>
    await new Promise<Response>((_resolve, reject) => {
      init?.signal?.addEventListener("abort", () => {
        reject(new DOMException("Aborted", "AbortError"));
      });
    });

  await assert.rejects(
    requestAgnesDecision(decisionRequest, {
      apiKey: "test-key",
      fetchFn,
      timeoutMs: 5,
    }),
    (error: unknown) =>
      error instanceof AgnesClientError && error.code === "TIMEOUT",
  );
});
test("上游不是合法 JSON 时拒绝结果", async () => {
  const fetchFn: typeof fetch = async () =>
    new Response("not-json", { status: 200 });

  await assert.rejects(
    requestAgnesDecision(decisionRequest, { apiKey: "test-key", fetchFn }),
    (error: unknown) =>
      error instanceof AgnesClientError && error.code === "INVALID_RESPONSE",
  );
});

test("上游没有强制函数调用时拒绝结果", async () => {
  const fetchFn: typeof fetch = async () =>
    new Response(
      JSON.stringify({ choices: [{ message: { content: "ok" } }] }),
      { status: 200 },
    );

  await assert.rejects(
    requestAgnesDecision(decisionRequest, { apiKey: "test-key", fetchFn }),
    (error: unknown) =>
      error instanceof AgnesClientError &&
      error.code === "INVALID_RESPONSE" &&
      /submit_agent_decision/.test(error.message),
  );
});

test("函数参数不是合法 JSON 时拒绝结果", async () => {
  const fetchFn: typeof fetch = async () =>
    new Response(
      JSON.stringify({
        choices: [
          {
            message: {
              tool_calls: [
                {
                  function: {
                    name: "submit_agent_decision",
                    arguments: "{invalid",
                  },
                },
              ],
            },
          },
        ],
      }),
      { status: 200 },
    );

  await assert.rejects(
    requestAgnesDecision(decisionRequest, { apiKey: "test-key", fetchFn }),
    (error: unknown) =>
      error instanceof AgnesClientError && error.code === "INVALID_RESPONSE",
  );
});

test("拒绝引用未发送给 Agnes 的 Memory", async () => {
  const fetchFn: typeof fetch = async () =>
    createAgnesResponse({
      ...validDecision,
      memoryReferences: ["unknown-memory"],
    });

  await assert.rejects(
    requestAgnesDecision(decisionRequest, { apiKey: "test-key", fetchFn }),
    (error: unknown) =>
      error instanceof AgnesClientError && error.code === "INVALID_RESPONSE",
  );
});
