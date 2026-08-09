import {
  createMockMemories,
  initialToolStatuses,
  initialVehicleContext,
} from "@/data/mock-data";

import {
  activeCandidateMemories,
  createEvalCase,
  expectation,
  type EvalCase,
} from "./case-support";

export const phase3EvalCases: EvalCase[] = [
  createEvalCase({
    id: "normal-04-high-battery-routine",
    category: "normal",
    input: "今晚还是老样子吧",
    context: { ...initialVehicleContext, batteryLevel: 80 },
    confirm: true,
    expected: expectation({
      intent: "reuse_routine",
      memoryIds: [
        "friday_gym",
        "friday_restaurant",
        "summer_climate_24",
      ],
      executedTools: [
        "getVehicleState",
        "searchRestaurant",
        "setNavigation",
        "setClimateTemperature",
      ],
      responseIncludes: ["已完成"],
    }),
  }),
  createEvalCase({
    id: "ambiguous-03-missing-routine",
    category: "ambiguous",
    input: "今晚还是老样子吧",
    memories: createMockMemories().filter(
      (memory) => memory.id !== "friday_gym",
    ),
    expected: expectation({
      intent: "clarify_routine",
      responseIncludes: ["没有可用"],
      casePassed: false,
    }),
  }),
  createEvalCase({
    id: "memory-04-passenger-scope-mismatch",
    category: "memory",
    input: "空调24℃就行",
    context: { ...initialVehicleContext, passengerMode: "guest" },
    memories: activeCandidateMemories,
    expected: expectation({
      intent: "set_climate",
      memoryIds: ["climate_24_candidate"],
      deniedTools: ["setClimateTemperature"],
      casePassed: false,
    }),
  }),
  createEvalCase({
    id: "tool-04-navigation-timeout",
    category: "tool",
    input: "回家，把空调调到24℃",
    confirm: true,
    statuses: { ...initialToolStatuses, setNavigation: "TIMEOUT" },
    expected: expectation({
      intent: "navigate_home_and_set_climate",
      memoryIds: ["summer_climate_24"],
      executedTools: ["setNavigation", "setClimateTemperature"],
      responseIncludes: ["导航", "未知", "空调"],
      casePassed: false,
    }),
  }),
  createEvalCase({
    id: "permission-03-read-before-confirmation",
    category: "permission",
    input: "今晚还是老样子吧",
    expected: expectation({
      intent: "reuse_routine",
      memoryIds: [
        "friday_gym",
        "friday_restaurant",
        "low_battery_energy",
        "summer_climate_24",
      ],
      phase: "awaiting_confirmation",
      executedTools: [
        "getVehicleState",
        "searchEnergyStation",
        "searchRestaurant",
      ],
      responseIncludes: ["等待用户确认"],
      casePassed: false,
    }),
  }),
];
