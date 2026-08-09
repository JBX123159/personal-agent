import {
  createMockMemories,
  initialToolStatuses,
  initialVehicleContext,
} from "@/data/mock-data";
import { createMockAgentDecision } from "@/lib/mock-agent-decision";

import {
  activeCandidateMemories,
  createEvalCase,
  createScenario02Memories,
  expectation,
  type EvalCase,
} from "./case-support";
import { phase3EvalCases } from "./phase3-cases";

export type { EvalCase, EvalCategory, EvalExpectation } from "./case-support";
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

const baseEvalCases: EvalCase[] = [
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

export const evalCases: EvalCase[] = [...baseEvalCases, ...phase3EvalCases];
