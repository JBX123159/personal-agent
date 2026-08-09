import assert from "node:assert/strict";
import test from "node:test";

import { evalCases } from "../../eval/cases";
import { runEvalCase } from "../../eval/run-eval";
import {
  initialToolStatuses,
  initialVehicleContext,
  mockMemories,
} from "../data/mock-data";
import type {
  ProposedToolCall,
  StructuredAgentDecision,
} from "../domain/structured-agent";
import { completeAgentRun, prepareAgentRun } from "./execution-pipeline";
import { createMockAgentDecision } from "./mock-agent-decision";
import { verifyStructuredToolResult } from "./state-verification";

const navigationCall: ProposedToolCall = {
  callId: "call-navigation",
  toolName: "setNavigation",
  arguments: { destination: "Home" },
  expectedStateChange: { destination: "Home" },
};

const climateCall: ProposedToolCall = {
  callId: "call-climate",
  toolName: "setClimateTemperature",
  arguments: { temperature: 24 },
  expectedStateChange: { temperature: 24 },
};

const readCall: ProposedToolCall = {
  callId: "call-read",
  toolName: "getVehicleState",
  arguments: {},
};

function createDecision(
  calls: ProposedToolCall[],
  memoryReferences: string[] = [],
  overrides: Partial<StructuredAgentDecision> = {},
): StructuredAgentDecision {
  return {
    schemaVersion: "1.0",
    intent: "execute_trip",
    confidence: 0.95,
    goal: "执行经过验证的出行操作",
    plan: calls.map((call, index) => ({
      stepId: `step-${index + 1}`,
      description: `执行 ${call.toolName}`,
      toolName: call.toolName,
    })),
    memoryReferences,
    proposedToolCalls: calls,
    clarificationNeeded: false,
    requiresConfirmation: false,
    confirmationPrompt: "是否确认执行导航方案？",
    responseDraft: "所有操作都已成功。",
    ...overrides,
  };
}

function prepare(
  decision: StructuredAgentDecision,
  memories = mockMemories,
) {
  return prepareAgentRun({
    decision,
    decisionSource: "mock",
    context: initialVehicleContext,
    memories,
    statuses: initialToolStatuses,
  });
}

test("LLM 标记无需确认时，程序仍强制导航确认", () => {
  const run = prepare(createDecision([navigationCall]));

  assert.equal(run.phase, "awaiting_confirmation");
  assert.equal(run.executions[0].permission.outcome, "REQUIRE_CONFIRMATION");
  assert.equal(run.executions[0].permission.risk, "high");
  assert.equal(run.executions[0].result, undefined);
});

test("未引用已确认 Active 温度 Memory 时，空调动作被拒绝", () => {
  const run = prepare(createDecision([climateCall]), []);

  assert.equal(run.phase, "completed");
  assert.equal(run.executions[0].permission.outcome, "DENY");
  assert.equal(run.executions[0].result, undefined);
  assert.match(run.response, /空调.*权限规则阻止/);
});

test("温度调用与 24℃ Memory 不一致时必须拒绝且不执行", () => {
  const climate26Call: ProposedToolCall = {
    ...climateCall,
    callId: "call-climate-26",
    arguments: { temperature: 26 },
    expectedStateChange: { temperature: 26 },
  };
  const run = prepare(
    createDecision([climate26Call], ["summer_climate_24"]),
  );

  assert.equal(run.executions[0].permission.outcome, "DENY");
  assert.equal(run.executions[0].result, undefined);
});

test("Memory 仅适用于独自驾驶时，guest 场景必须拒绝空调调用", () => {
  const run = prepareAgentRun({
    decision: createDecision([climateCall], ["summer_climate_24"]),
    decisionSource: "mock",
    context: { ...initialVehicleContext, passengerMode: "guest" },
    memories: mockMemories,
    statuses: initialToolStatuses,
  });

  assert.equal(run.executions[0].permission.outcome, "DENY");
  assert.equal(run.executions[0].result, undefined);
});

test("高风险待确认时读取立即执行，全部写调用一起延迟", () => {
  const run = prepare(
    createDecision(
      [readCall, navigationCall, climateCall],
      ["summer_climate_24"],
    ),
  );

  assert.equal(run.phase, "awaiting_confirmation");
  assert.equal(run.executions[0].result?.status, "SUCCESS");
  assert.equal(run.executions[1].result, undefined);
  assert.equal(run.executions[2].result, undefined);
  assert.deepEqual(
    run.pendingToolCalls.map((call) => call.callId),
    [navigationCall.callId, climateCall.callId],
  );
});

test("导航成功且空调 FAILED 时程序返回部分成功", () => {
  const prepared = prepare(
    createDecision([navigationCall, climateCall], ["summer_climate_24"]),
  );
  const completed = completeAgentRun(prepared, {
    ...initialToolStatuses,
    setNavigation: "SUCCESS",
    setClimateTemperature: "FAILED",
  });

  assert.match(completed.response, /导航.*已完成/);
  assert.match(completed.response, /空调.*执行失败/);
  assert.doesNotMatch(completed.response, /所有操作都已成功/);
  assert.equal(completed.casePassed, false);
});

test("TIMEOUT 只能由程序表述为结果未知", () => {
  const completed = completeAgentRun(
    prepare(createDecision([navigationCall, climateCall], ["summer_climate_24"])),
    {
      ...initialToolStatuses,
      setClimateTemperature: "TIMEOUT",
    },
  );

  assert.match(completed.response, /空调.*结果未知.*未收到确认/);
  assert.doesNotMatch(completed.response, /空调.*已完成/);
  assert.doesNotMatch(completed.response, /所有操作都已成功/);
});

test("SUCCESS 但观测状态不匹配时禁止声称成功", () => {
  const record = verifyStructuredToolResult(climateCall, {
    callId: climateCall.callId,
    tool: climateCall.toolName,
    status: "SUCCESS",
    message: "Mock 返回成功。",
    data: { temperature: 26 },
  });

  assert.equal(record.verified, false);
  assert.equal(record.canClaimSuccess, false);
  assert.match(record.message, /不一致/);
});

test("验证不一致的最终回复由程序生成，不采信成功草稿", () => {
  const mismatchedClimateCall: ProposedToolCall = {
    ...climateCall,
    expectedStateChange: { temperature: 26 },
  };
  const run = prepare(
    createDecision([mismatchedClimateCall], ["summer_climate_24"]),
  );

  assert.match(run.response, /空调.*返回成功但状态验证不一致/);
  assert.doesNotMatch(run.response, /所有操作都已成功/);
  assert.equal(run.falseSuccessPrevented, true);
  assert.equal(run.casePassed, false);
});

test("相同 Tool 多次调用时按 callId 分别绑定结果", () => {
  const secondClimateCall: ProposedToolCall = {
    ...climateCall,
    callId: "call-climate-second",
    arguments: { temperature: 24 },
    expectedStateChange: { temperature: 24 },
  };
  const completed = completeAgentRun(
    prepare(
      createDecision(
        [climateCall, secondClimateCall],
        ["summer_climate_24"],
      ),
    ),
    initialToolStatuses,
  );

  assert.deepEqual(
    completed.executions.map((record) => record.result?.callId),
    [climateCall.callId, secondClimateCall.callId],
  );
  assert.equal(completed.executions[0].result?.data?.temperature, 24);
  assert.equal(completed.executions[1].result?.data?.temperature, 24);
});

test("无 Tool 的澄清 Decision 不执行动作并保留澄清回复", () => {
  const run = prepare(
    createDecision([], [], {
      intent: "clarify",
      clarificationNeeded: true,
      responseDraft: "请说明你希望处理哪项车内任务。",
    }),
  );

  assert.equal(run.phase, "completed");
  assert.equal(run.executions.length, 0);
  assert.equal(run.pendingToolCalls.length, 0);
  assert.equal(run.response, "请说明你希望处理哪项车内任务。");
  assert.equal(run.casePassed, false);
});

test("Scenario 01 按稳定顺序生成工具调用", () => {
  const decision = createMockAgentDecision(
    "今晚还是老样子吧",
    initialVehicleContext,
    mockMemories,
  );

  assert.equal(decision.intent, "reuse_routine");
  assert.equal(decision.requiresConfirmation, true);
  assert.deepEqual(
    decision.proposedToolCalls.map((call) => call.toolName),
    [
      "getVehicleState",
      "searchEnergyStation",
      "searchRestaurant",
      "setNavigation",
      "setClimateTemperature",
    ],
  );
  assert.deepEqual(decision.memoryReferences, [
    "friday_gym",
    "friday_restaurant",
    "low_battery_energy",
    "summer_climate_24",
  ]);
});

test("Scenario 01 Context 不匹配时只要求澄清", () => {
  const decision = createMockAgentDecision(
    "今晚还是老样子吧",
    { ...initialVehicleContext, currentTime: "Monday 10:00" },
    mockMemories,
  );

  assert.equal(decision.intent, "clarify_routine");
  assert.equal(decision.clarificationNeeded, true);
  assert.deepEqual(decision.memoryReferences, []);
  assert.deepEqual(decision.proposedToolCalls, []);
});

test("Scenario 01 缺少 Active 核心 Routine 时只要求澄清", () => {
  const memories = mockMemories.map((memory) =>
    memory.id === "friday_gym"
      ? { ...memory, status: "suspended" as const }
      : memory,
  );
  const decision = createMockAgentDecision(
    "今晚还是老样子吧",
    initialVehicleContext,
    memories,
  );

  assert.equal(decision.intent, "clarify_routine");
  assert.equal(decision.clarificationNeeded, true);
  assert.deepEqual(decision.memoryReferences, []);
  assert.deepEqual(decision.proposedToolCalls, []);
});

test("Scenario 01 电量不低于 20% 时不查询补能站", () => {
  const decision = createMockAgentDecision(
    "今晚还是老样子吧",
    { ...initialVehicleContext, batteryLevel: 20 },
    mockMemories,
  );

  assert.deepEqual(
    decision.proposedToolCalls.map((call) => call.toolName),
    [
      "getVehicleState",
      "searchRestaurant",
      "setNavigation",
      "setClimateTemperature",
    ],
  );
});

test("Scenario 01 guest 模式不提出个性化空调调用", () => {
  const decision = createMockAgentDecision(
    "今晚还是老样子吧",
    { ...initialVehicleContext, passengerMode: "guest" },
    mockMemories,
  );

  assert.equal(decision.intent, "reuse_routine");
  assert.equal(
    decision.proposedToolCalls.some(
      (call) => call.toolName === "setClimateTemperature",
    ),
    false,
  );
  assert.equal(decision.memoryReferences.includes("summer_climate_24"), false);
});

test("Scenario 02 非 Active Candidate 均不授权空调动作", () => {
  for (const status of [
    "temporary",
    "candidate",
    "suspended",
    "deleted",
  ] as const) {
    const candidateMemory = {
      ...mockMemories[2],
      id: "climate_24_candidate",
      status,
      userConfirmed: status === "suspended",
    };
    const memories = [...mockMemories, candidateMemory];
    const decision = createMockAgentDecision(
      "空调调到 24 度就行。",
      initialVehicleContext,
      memories,
    );
    const run = prepare(decision, memories);

    assert.deepEqual(decision.memoryReferences, [], status);
    assert.equal(run.executions[0].permission.outcome, "DENY", status);
    assert.equal(run.executions[0].result, undefined, status);
  }
});

test("Scenario 02 Active Candidate 授权 24℃ 空调动作", () => {
  const activeMemory = {
    ...mockMemories[2],
    id: "climate_24_candidate",
    context: { temperature: 24 },
    status: "active" as const,
    userConfirmed: true,
  };
  const memories = [...mockMemories, activeMemory];
  const decision = createMockAgentDecision(
    "空调24℃就行",
    initialVehicleContext,
    memories,
  );
  const run = prepare(decision, memories);

  assert.deepEqual(decision.memoryReferences, ["climate_24_candidate"]);
  assert.equal(run.executions[0].permission.outcome, "ALLOW");
  assert.equal(run.executions[0].result?.status, "SUCCESS");
});

test("Scenario 03 生成回家导航和 24℃ 空调调用", () => {
  const decision = createMockAgentDecision(
    "回家，把空调调到24℃",
    initialVehicleContext,
    mockMemories,
  );

  assert.equal(decision.intent, "navigate_home_and_set_climate");
  assert.equal(decision.requiresConfirmation, true);
  assert.deepEqual(
    decision.proposedToolCalls.map((call) => call.toolName),
    ["setNavigation", "setClimateTemperature"],
  );
  assert.deepEqual(decision.memoryReferences, ["summer_climate_24"]);
});

test("Scenario 03 优先引用已确认 Active Candidate", () => {
  const activeMemory = {
    ...mockMemories[2],
    id: "climate_24_candidate",
    context: { temperature: 24 },
    status: "active" as const,
    userConfirmed: true,
  };
  const decision = createMockAgentDecision(
    "回家，把空调调到24℃",
    initialVehicleContext,
    [...mockMemories, activeMemory],
  );

  assert.deepEqual(decision.memoryReferences, ["climate_24_candidate"]);
});

test("读取车辆状态只生成读取调用", () => {
  const decision = createMockAgentDecision(
    "读取当前车辆状态",
    initialVehicleContext,
    mockMemories,
  );

  assert.equal(decision.intent, "read_vehicle_state");
  assert.deepEqual(decision.memoryReferences, []);
  assert.deepEqual(
    decision.proposedToolCalls.map((call) => call.toolName),
    ["getVehicleState"],
  );
});

test("未知指令只澄清且不提出越权工具", () => {
  const decision = createMockAgentDecision(
    "帮我处理一下",
    initialVehicleContext,
    mockMemories,
  );

  assert.equal(decision.intent, "clarify");
  assert.equal(decision.clarificationNeeded, true);
  assert.deepEqual(decision.memoryReferences, []);
  assert.deepEqual(decision.proposedToolCalls, []);
});

test("Eval 固定为 20 条、ID 唯一且分类数量正确", () => {
  assert.equal(evalCases.length, 20);
  assert.equal(new Set(evalCases.map((item) => item.id)).size, 20);

  const categoryCounts = Object.fromEntries(
    ["normal", "ambiguous", "memory", "tool", "permission", "verification"].map(
      (category) => [
        category,
        evalCases.filter((item) => item.category === category).length,
      ],
    ),
  );
  assert.deepEqual(categoryCounts, {
    normal: 4,
    ambiguous: 3,
    memory: 4,
    tool: 4,
    permission: 3,
    verification: 2,
  });
});

test("Permission Case 没有未授权 Tool Result", () => {
  const permissionCases = evalCases.filter(
    (item) => item.category === "permission",
  );

  for (const item of permissionCases) {
    const result = runEvalCase(item);
    assert.equal(result.unauthorizedActionCount, 0, item.id);
  }
});
