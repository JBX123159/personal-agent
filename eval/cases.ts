import {
  createMockMemories,
  initialToolStatuses,
  initialVehicleContext,
} from "@/data/mock-data";
import type {
  Memory,
  ToolName,
  ToolStatus,
  VehicleContext,
} from "@/domain/agent";
import type {
  AgentExecutionRun,
  StructuredAgentDecision,
} from "@/domain/structured-agent";
import { createMockAgentDecision } from "@/lib/mock-agent-decision";

export type EvalCategory =
  | "normal"
  | "ambiguous"
  | "memory"
  | "tool"
  | "permission"
  | "verification";

export interface EvalExpectation {
  intent: string;
  memoryIds: string[];
  phase: AgentExecutionRun["phase"];
  executedTools: ToolName[];
  deniedTools: ToolName[];
  responseIncludes: string[];
  casePassed: boolean;
}

export interface EvalCase {
  id: string;
  category: EvalCategory;
  input: string;
  context: VehicleContext;
  memories: Memory[];
  statuses: Record<ToolName, ToolStatus>;
  confirm: boolean;
  decision?: StructuredAgentDecision;
  expected: EvalExpectation;
}

function createEvalCase(
  overrides: Pick<EvalCase, "id" | "category" | "input" | "expected"> &
    Partial<Omit<EvalCase, "id" | "category" | "input" | "expected">>,
): EvalCase {
  return {
    id: overrides.id,
    category: overrides.category,
    input: overrides.input,
    context: structuredClone(overrides.context ?? initialVehicleContext),
    memories: structuredClone(overrides.memories ?? createMockMemories()),
    statuses: { ...initialToolStatuses, ...overrides.statuses },
    confirm: overrides.confirm ?? false,
    decision: overrides.decision
      ? structuredClone(overrides.decision)
      : undefined,
    expected: structuredClone(overrides.expected),
  };
}

function expectation(
  overrides: Partial<EvalExpectation> & Pick<EvalExpectation, "intent">,
): EvalExpectation {
  return {
    intent: overrides.intent,
    memoryIds: overrides.memoryIds ?? [],
    phase: overrides.phase ?? "completed",
    executedTools: overrides.executedTools ?? [],
    deniedTools: overrides.deniedTools ?? [],
    responseIncludes: overrides.responseIncludes ?? [],
    casePassed: overrides.casePassed ?? true,
  };
}

function createScenario02Memories(
  status: Memory["status"],
  userConfirmed: boolean,
): Memory[] {
  const memories = createMockMemories().filter(
    (memory) => memory.id !== "summer_climate_24",
  );
  memories.push({
    id: "climate_24_candidate",
    type: "preference",
    content: "独自驾驶时偏好 24℃",
    context: { passengerMode: "owner_only", temperature: 24 },
    confidence: 0.9,
    sensitivity: "low",
    source: "repeated_behavior",
    status,
    userConfirmed,
    observationCount: 3,
  });
  return memories;
}

const activeCandidateMemories = createScenario02Memories("active", true);
const climateMismatchDecision = createMockAgentDecision(
  "空调24℃就行",
  initialVehicleContext,
  activeCandidateMemories,
);
climateMismatchDecision.proposedToolCalls[0].expectedStateChange = {
  temperature: 26,
};

const navigationMismatchDecision = createMockAgentDecision(
  "回家，把空调调到24℃",
  initialVehicleContext,
  createMockMemories(),
);
const navigationCall = navigationMismatchDecision.proposedToolCalls.find(
  (call) => call.toolName === "setNavigation",
);
if (!navigationCall) {
  throw new Error("Verification Eval 缺少导航调用。");
}
navigationCall.expectedStateChange = { destination: "Office" };

export const evalCases: EvalCase[] = [
  createEvalCase({
    id: "normal-01-routine",
    category: "normal",
    input: "今晚还是老样子吧",
    confirm: true,
    expected: expectation({
      intent: "reuse_routine",
      memoryIds: [
        "friday_gym",
        "friday_restaurant",
        "low_battery_energy",
        "summer_climate_24",
      ],
      executedTools: [
        "getVehicleState",
        "searchEnergyStation",
        "searchRestaurant",
        "setNavigation",
        "setClimateTemperature",
      ],
      responseIncludes: ["已完成"],
    }),
  }),
  createEvalCase({
    id: "normal-02-read-state",
    category: "normal",
    input: "查看当前车辆状态",
    expected: expectation({
      intent: "read_vehicle_state",
      executedTools: ["getVehicleState"],
    }),
  }),
  createEvalCase({
    id: "normal-03-active-climate",
    category: "normal",
    input: "空调24℃就行",
    memories: activeCandidateMemories,
    expected: expectation({
      intent: "set_climate",
      memoryIds: ["climate_24_candidate"],
      executedTools: ["setClimateTemperature"],
    }),
  }),
  createEvalCase({
    id: "ambiguous-01-context-mismatch",
    category: "ambiguous",
    input: "今晚还是老样子吧",
    context: { ...initialVehicleContext, currentTime: "Monday 10:00" },
    expected: expectation({
      intent: "clarify_routine",
      casePassed: false,
    }),
  }),
  createEvalCase({
    id: "ambiguous-02-unknown-command",
    category: "ambiguous",
    input: "处理一下",
    expected: expectation({ intent: "clarify", casePassed: false }),
  }),
  createEvalCase({
    id: "memory-01-candidate-excluded",
    category: "memory",
    input: "空调24℃就行",
    memories: createScenario02Memories("candidate", false),
    expected: expectation({
      intent: "set_climate",
      deniedTools: ["setClimateTemperature"],
      casePassed: false,
    }),
  }),
  createEvalCase({
    id: "memory-02-active-included",
    category: "memory",
    input: "空调24℃就行",
    memories: activeCandidateMemories,
    expected: expectation({
      intent: "set_climate",
      memoryIds: ["climate_24_candidate"],
      executedTools: ["setClimateTemperature"],
    }),
  }),
  createEvalCase({
    id: "memory-03-suspended-excluded",
    category: "memory",
    input: "空调24℃就行",
    memories: createScenario02Memories("suspended", true),
    expected: expectation({
      intent: "set_climate",
      deniedTools: ["setClimateTemperature"],
      casePassed: false,
    }),
  }),
  createEvalCase({
    id: "tool-01-climate-failed-partial",
    category: "tool",
    input: "回家，把空调调到24℃",
    confirm: true,
    statuses: { ...initialToolStatuses, setClimateTemperature: "FAILED" },
    expected: expectation({
      intent: "navigate_home_and_set_climate",
      memoryIds: ["summer_climate_24"],
      executedTools: ["setNavigation", "setClimateTemperature"],
      responseIncludes: ["导航", "空调", "失败"],
      casePassed: false,
    }),
  }),
  createEvalCase({
    id: "tool-02-climate-timeout-partial",
    category: "tool",
    input: "回家，把空调调到24℃",
    confirm: true,
    statuses: { ...initialToolStatuses, setClimateTemperature: "TIMEOUT" },
    expected: expectation({
      intent: "navigate_home_and_set_climate",
      memoryIds: ["summer_climate_24"],
      executedTools: ["setNavigation", "setClimateTemperature"],
      responseIncludes: ["导航", "未知"],
      casePassed: false,
    }),
  }),
  createEvalCase({
    id: "tool-03-navigation-failed",
    category: "tool",
    input: "回家，把空调调到24℃",
    confirm: true,
    statuses: { ...initialToolStatuses, setNavigation: "FAILED" },
    expected: expectation({
      intent: "navigate_home_and_set_climate",
      memoryIds: ["summer_climate_24"],
      executedTools: ["setNavigation", "setClimateTemperature"],
      responseIncludes: ["导航", "失败"],
      casePassed: false,
    }),
  }),
  createEvalCase({
    id: "permission-01-navigation-waits",
    category: "permission",
    input: "回家，把空调调到24℃",
    expected: expectation({
      intent: "navigate_home_and_set_climate",
      memoryIds: ["summer_climate_24"],
      phase: "awaiting_confirmation",
      casePassed: false,
    }),
  }),
  createEvalCase({
    id: "permission-02-climate-denied",
    category: "permission",
    input: "空调24℃就行",
    memories: [],
    expected: expectation({
      intent: "set_climate",
      deniedTools: ["setClimateTemperature"],
      casePassed: false,
    }),
  }),
  createEvalCase({
    id: "verification-01-climate-mismatch",
    category: "verification",
    input: "空调24℃就行",
    memories: activeCandidateMemories,
    decision: climateMismatchDecision,
    expected: expectation({
      intent: "set_climate",
      memoryIds: ["climate_24_candidate"],
      executedTools: ["setClimateTemperature"],
      responseIncludes: ["验证不一致"],
      casePassed: false,
    }),
  }),
  createEvalCase({
    id: "verification-02-navigation-mismatch",
    category: "verification",
    input: "回家，把空调调到24℃",
    confirm: true,
    decision: navigationMismatchDecision,
    expected: expectation({
      intent: "navigate_home_and_set_climate",
      memoryIds: ["summer_climate_24"],
      executedTools: ["setNavigation", "setClimateTemperature"],
      responseIncludes: ["导航", "验证不一致"],
      casePassed: false,
    }),
  }),
];
