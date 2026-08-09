import assert from "node:assert/strict";
import test from "node:test";

import {
  AGENT_DECISION_TOOL,
  parseAgentDecision,
  parseAgentDecisionRequest,
} from "./agent-decision-schema";

const validDecision = {
  schemaVersion: "1.0",
  intent: "set_climate",
  confidence: 0.95,
  goal: "将座舱温度调到 24℃",
  plan: [
    {
      stepId: "step-1",
      description: "设置座舱温度",
      toolName: "setClimateTemperature",
    },
  ],
  memoryReferences: ["summer_climate_24"],
  proposedToolCalls: [
    {
      callId: "call-1",
      toolName: "setClimateTemperature",
      arguments: { temperature: 24 },
      expectedStateChange: { temperature: 24 },
    },
  ],
  clarificationNeeded: false,
  requiresConfirmation: false,
  responseDraft: "准备设置空调。",
};

const validRequest = {
  userInput: "空调 24℃ 就行",
  context: {
    currentTime: "Friday 17:40",
    location: "Office",
    batteryLevel: 19,
    passengerMode: "owner_only",
    cabinTemperature: 31,
    weather: "晴，32℃",
    currentRoute: "",
  },
  memories: [
    {
      id: "summer_climate_24",
      type: "preference",
      content: "夏季独自驾驶时偏好 24℃",
      context: { passengerMode: "owner_only" },
      confidence: 0.98,
      sensitivity: "low",
      source: "explicit",
      status: "temporary",
      userConfirmed: false,
      observationCount: 2,
    },
  ],
};

test("接受合法 AgentDecision", () => {
  const parsed = parseAgentDecision(
    validDecision,
    new Set(["summer_climate_24"]),
  );
  assert.equal(parsed.schemaVersion, "1.0");
  assert.equal(parsed.proposedToolCalls[0].toolName, "setClimateTemperature");
});

test("拒绝缺少字段和额外字段", () => {
  const missingGoal = structuredClone(validDecision) as Record<string, unknown>;
  delete missingGoal.goal;
  assert.throws(
    () => parseAgentDecision(missingGoal, new Set(["summer_climate_24"])),
    /goal/,
  );

  assert.throws(
    () =>
      parseAgentDecision(
        { ...validDecision, unexpected: true },
        new Set(["summer_climate_24"]),
      ),
    /未知字段.*unexpected/,
  );
});

test("拒绝越界字符串、数组和置信度", () => {
  assert.throws(
    () =>
      parseAgentDecision(
        { ...validDecision, intent: "" },
        new Set(["summer_climate_24"]),
      ),
    /intent/,
  );
  assert.throws(
    () =>
      parseAgentDecision(
        { ...validDecision, confidence: 1.1 },
        new Set(["summer_climate_24"]),
      ),
    /confidence/,
  );
  assert.throws(
    () =>
      parseAgentDecision(
        { ...validDecision, plan: Array(9).fill(validDecision.plan[0]) },
        new Set(["summer_climate_24"]),
      ),
    /plan/,
  );
});

test("拒绝未知 Tool", () => {
  const invalid = structuredClone(validDecision);
  invalid.proposedToolCalls[0].toolName = "openDoor";
  assert.throws(
    () => parseAgentDecision(invalid, new Set(["summer_climate_24"])),
    /未知 Tool/,
  );
});

test("拒绝未提供给 Agnes 的 Memory 引用", () => {
  assert.throws(
    () => parseAgentDecision(validDecision, new Set()),
    /Memory 引用不在允许列表/,
  );
});

test("拒绝重复 Memory、Step 和 Call 标识", () => {
  assert.throws(
    () =>
      parseAgentDecision(
        {
          ...validDecision,
          memoryReferences: ["summer_climate_24", "summer_climate_24"],
        },
        new Set(["summer_climate_24"]),
      ),
    /memoryReferences.*重复/,
  );

  const duplicatePlan = [validDecision.plan[0], validDecision.plan[0]];
  assert.throws(
    () =>
      parseAgentDecision(
        { ...validDecision, plan: duplicatePlan },
        new Set(["summer_climate_24"]),
      ),
    /stepId.*重复/,
  );

  const duplicateCalls = [
    validDecision.proposedToolCalls[0],
    validDecision.proposedToolCalls[0],
  ];
  assert.throws(
    () =>
      parseAgentDecision(
        { ...validDecision, proposedToolCalls: duplicateCalls },
        new Set(["summer_climate_24"]),
      ),
    /callId.*重复/,
  );
});

test("严格校验每个 Tool 的参数", () => {
  const invalidTemperature = structuredClone(validDecision);
  invalidTemperature.proposedToolCalls[0].arguments = { temperature: 99 };
  assert.throws(
    () =>
      parseAgentDecision(
        invalidTemperature,
        new Set(["summer_climate_24"]),
      ),
    /temperature/,
  );

  const navigation = structuredClone(validDecision);
  (navigation.proposedToolCalls as unknown as Array<Record<string, unknown>>)[0] = {
    callId: "call-1",
    toolName: "setNavigation",
    arguments: { destination: "" },
    expectedStateChange: { destination: "家" },
  };
  assert.throws(
    () => parseAgentDecision(navigation, new Set(["summer_climate_24"])),
    /destination/,
  );

  const readWithUnknownArgument = structuredClone(validDecision);
  (
    readWithUnknownArgument.proposedToolCalls as unknown as Array<
      Record<string, unknown>
    >
  )[0] = {
    callId: "call-1",
    toolName: "getVehicleState",
    arguments: { secret: true },
    expectedStateChange: {},
  };
  assert.throws(
    () =>
      parseAgentDecision(
        readWithUnknownArgument,
        new Set(["summer_climate_24"]),
      ),
    /arguments.*未知参数.*secret/,
  );

  const searchWithEmptyArguments = structuredClone(validDecision);
  (
    searchWithEmptyArguments.proposedToolCalls as unknown as Array<
      Record<string, unknown>
    >
  )[0] = {
    callId: "call-1",
    toolName: "searchEnergyStation",
    arguments: {},
  };
  const parsedSearch = parseAgentDecision(
    searchWithEmptyArguments,
    new Set(["summer_climate_24"]),
  );
  assert.deepEqual(parsedSearch.proposedToolCalls[0].arguments, {});

  const searchWithLocation = structuredClone(searchWithEmptyArguments);
  (
    searchWithLocation.proposedToolCalls as unknown as Array<
      Record<string, unknown>
    >
  )[0] = {
    callId: "call-1",
    toolName: "searchEnergyStation",
    arguments: { location: "Office" },
  };
  assert.throws(
    () =>
      parseAgentDecision(
        searchWithLocation,
        new Set(["summer_climate_24"]),
      ),
    /proposedToolCalls\[0\]\.arguments.*location/,
  );

  const expectedStateWithUnknownField = structuredClone(validDecision);
  expectedStateWithUnknownField.proposedToolCalls[0].expectedStateChange = {
    temperature: 24,
    location: "Office",
  } as unknown as { temperature: number };
  assert.throws(
    () =>
      parseAgentDecision(
        expectedStateWithUnknownField,
        new Set(["summer_climate_24"]),
      ),
    /expectedStateChange.*location/,
  );
});

test("校验客户端 Decision Request", () => {
  const parsed = parseAgentDecisionRequest(validRequest);
  assert.equal(parsed.userInput, "空调 24℃ 就行");
  assert.equal(parsed.memories.length, 1);
  assert.equal(parsed.memories[0].status, "temporary");
  assert.equal(parsed.memories[0].observationCount, 2);

  assert.throws(
    () => parseAgentDecisionRequest({ ...validRequest, userInput: "" }),
    /userInput/,
  );
  assert.throws(
    () =>
      parseAgentDecisionRequest({
        ...validRequest,
        context: { ...validRequest.context, batteryLevel: 101 },
      }),
    /batteryLevel/,
  );
  assert.throws(
    () =>
      parseAgentDecisionRequest({
        ...validRequest,
        memories: Array(21).fill(validRequest.memories[0]),
      }),
    /memories/,
  );

  const missingObservationCount = structuredClone(validRequest) as {
    memories: Array<Record<string, unknown>>;
  };
  delete missingObservationCount.memories[0].observationCount;
  assert.throws(
    () => parseAgentDecisionRequest(missingObservationCount),
    /observationCount.*必填/,
  );

  assert.throws(
    () =>
      parseAgentDecisionRequest({
        ...validRequest,
        memories: [{ ...validRequest.memories[0], observationCount: 1001 }],
      }),
    /observationCount/,
  );

  assert.throws(
    () =>
      parseAgentDecisionRequest({
        ...validRequest,
        memories: [{ ...validRequest.memories[0], observationCount: 1.5 }],
      }),
    /observationCount.*整数/,
  );
});

test("导出强制 submit_agent_decision Tool Schema", () => {
  assert.equal(AGENT_DECISION_TOOL.type, "function");
  assert.equal(
    AGENT_DECISION_TOOL.function.name,
    "submit_agent_decision",
  );
  assert.equal(
    AGENT_DECISION_TOOL.function.parameters.additionalProperties,
    false,
  );

  const proposedToolCalls = AGENT_DECISION_TOOL.function.parameters.properties
    .proposedToolCalls;
  const callProperties = proposedToolCalls.items.properties;
  const argumentSchema = callProperties.arguments;
  const expectedStateChangeSchema = callProperties.expectedStateChange;

  assert.equal(argumentSchema.additionalProperties, false);
  assert.equal("required" in argumentSchema, false);
  assert.deepEqual(Object.keys(argumentSchema.properties).sort(), [
    "destination",
    "temperature",
  ]);
  assert.equal(argumentSchema.properties.temperature.minimum, -20);
  assert.equal(argumentSchema.properties.temperature.maximum, 60);
  assert.equal(argumentSchema.properties.destination.minLength, 1);
  assert.equal(argumentSchema.properties.destination.maxLength, 120);
  assert.equal(expectedStateChangeSchema.additionalProperties, false);
  assert.deepEqual(Object.keys(expectedStateChangeSchema.properties).sort(), [
    "destination",
    "temperature",
  ]);
});
