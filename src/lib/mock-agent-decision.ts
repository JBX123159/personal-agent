import type { Memory, VehicleContext } from "@/domain/agent";
import type {
  AgentPlanStep,
  ProposedToolCall,
  StructuredAgentDecision,
} from "@/domain/structured-agent";
import { parseAgentDecision } from "@/lib/agent-decision-schema";
import {
  isScenario01Input,
  selectScenario01Memories,
} from "@/lib/scenario-01-memory";

const CANDIDATE_CLIMATE_MEMORY_ID = "climate_24_candidate";
const LEGACY_CLIMATE_MEMORY_ID = "summer_climate_24";

const toolDescriptions: Record<ProposedToolCall["toolName"], string> = {
  getVehicleState: "读取当前车辆状态",
  searchEnergyStation: "查询可用补能站",
  searchRestaurant: "查询可用餐厅",
  setNavigation: "设置本次导航路线",
  setClimateTemperature: "将座舱温度设置为 24℃",
};

function normalizeInput(input: string): string {
  return input.replace(/[\s。！？!?，,、]/g, "");
}

function isActiveConfirmed(memory: Memory | undefined): memory is Memory {
  return memory?.status === "active" && memory.userConfirmed;
}

function matchesRoutineContext(context: VehicleContext): boolean {
  return (
    /friday|周五/i.test(context.currentTime) &&
    /office|公司|办公室/i.test(context.location)
  );
}

function createPlan(calls: ProposedToolCall[]): AgentPlanStep[] {
  return calls.map((call, index) => ({
    stepId: `step-${index + 1}`,
    description: toolDescriptions[call.toolName],
    toolName: call.toolName,
  }));
}

function createDecision(
  memories: Memory[],
  value: Omit<StructuredAgentDecision, "schemaVersion">,
): StructuredAgentDecision {
  const allowedMemoryIds = new Set(
    memories.filter(isActiveConfirmed).map((memory) => memory.id),
  );

  return parseAgentDecision(
    { schemaVersion: "1.0", ...value },
    allowedMemoryIds,
  );
}

function createClarification(
  memories: Memory[],
  intent: "clarify" | "clarify_routine",
  responseDraft: string,
): StructuredAgentDecision {
  return createDecision(memories, {
    intent,
    confidence: 1,
    goal: "确认用户希望执行的车内任务",
    plan: [],
    memoryReferences: [],
    proposedToolCalls: [],
    clarificationNeeded: true,
    requiresConfirmation: false,
    responseDraft,
  });
}

function createScenario01Decision(
  context: VehicleContext,
  memories: Memory[],
): StructuredAgentDecision {
  if (!matchesRoutineContext(context)) {
    return createClarification(
      memories,
      "clarify_routine",
      "当前时间或地点与周五下班场景不匹配，请说明今晚希望去哪里。",
    );
  }

  const selectedMemories = selectScenario01Memories(context, memories).filter(
    isActiveConfirmed,
  );
  const selectedIds = new Set(selectedMemories.map((memory) => memory.id));
  if (!selectedIds.has("friday_gym")) {
    return createClarification(
      memories,
      "clarify_routine",
      "没有可用的周五健身 Routine，请说明今晚希望去哪里。",
    );
  }

  const shouldSearchEnergy =
    context.batteryLevel < 20 && selectedIds.has("low_battery_energy");
  const shouldSetClimate =
    context.passengerMode === "owner_only" &&
    selectedIds.has(LEGACY_CLIMATE_MEMORY_ID);
  const destination = shouldSearchEnergy
    ? "健身房 → 补能站 → 备选餐厅"
    : "健身房 → 备选餐厅";

  const calls: ProposedToolCall[] = [
    {
      callId: "scenario-01-read-state",
      toolName: "getVehicleState",
      arguments: {},
    },
    ...(shouldSearchEnergy
      ? [
          {
            callId: "scenario-01-search-energy",
            toolName: "searchEnergyStation" as const,
            arguments: {},
          },
        ]
      : []),
    {
      callId: "scenario-01-search-restaurant",
      toolName: "searchRestaurant",
      arguments: {},
    },
    {
      callId: "scenario-01-navigation",
      toolName: "setNavigation",
      arguments: { destination },
      expectedStateChange: { destination },
    },
    ...(shouldSetClimate
      ? [
          {
            callId: "scenario-01-climate",
            toolName: "setClimateTemperature" as const,
            arguments: { temperature: 24 },
            expectedStateChange: { temperature: 24 },
          },
        ]
      : []),
  ];

  return createDecision(memories, {
    intent: "reuse_routine",
    confidence: 1,
    goal: "复用周五下班路线，并根据车辆状态安排补能和餐厅",
    plan: createPlan(calls),
    memoryReferences: selectedMemories.map((memory) => memory.id),
    proposedToolCalls: calls,
    clarificationNeeded: false,
    requiresConfirmation: true,
    confirmationPrompt: `是否确认设置导航：${destination}？`,
    responseDraft: "已整理今晚的路线方案，设置导航前需要你的确认。",
  });
}

function createScenario02Decision(
  memories: Memory[],
): StructuredAgentDecision {
  const candidateMemory = memories.find(
    (memory) => memory.id === CANDIDATE_CLIMATE_MEMORY_ID,
  );
  const memoryReferences = isActiveConfirmed(candidateMemory)
    ? [candidateMemory.id]
    : [];
  const calls: ProposedToolCall[] = [
    {
      callId: "scenario-02-climate",
      toolName: "setClimateTemperature",
      arguments: { temperature: 24 },
      expectedStateChange: { temperature: 24 },
    },
  ];

  return createDecision(memories, {
    intent: "set_climate",
    confidence: 1,
    goal: "将座舱温度设置为 24℃",
    plan: createPlan(calls),
    memoryReferences,
    proposedToolCalls: calls,
    clarificationNeeded: false,
    requiresConfirmation: false,
    responseDraft:
      memoryReferences.length > 0
        ? "将使用你已确认的 24℃ 偏好设置空调。"
        : "24℃ 偏好尚未确认，程序将根据权限规则决定是否执行。",
  });
}

function createScenario03Decision(
  memories: Memory[],
): StructuredAgentDecision {
  const candidateMemory = memories.find(
    (memory) => memory.id === CANDIDATE_CLIMATE_MEMORY_ID,
  );
  const legacyMemory = memories.find(
    (memory) => memory.id === LEGACY_CLIMATE_MEMORY_ID,
  );
  const climateMemory = isActiveConfirmed(candidateMemory)
    ? candidateMemory
    : isActiveConfirmed(legacyMemory)
      ? legacyMemory
      : undefined;
  const calls: ProposedToolCall[] = [
    {
      callId: "scenario-03-navigation",
      toolName: "setNavigation",
      arguments: { destination: "Home" },
      expectedStateChange: { destination: "Home" },
    },
    {
      callId: "scenario-03-climate",
      toolName: "setClimateTemperature",
      arguments: { temperature: 24 },
      expectedStateChange: { temperature: 24 },
    },
  ];

  return createDecision(memories, {
    intent: "navigate_home_and_set_climate",
    confidence: 1,
    goal: "设置回家导航，并将座舱温度设置为 24℃",
    plan: createPlan(calls),
    memoryReferences: climateMemory ? [climateMemory.id] : [],
    proposedToolCalls: calls,
    clarificationNeeded: false,
    requiresConfirmation: true,
    confirmationPrompt: "是否确认设置回家导航？",
    responseDraft: "回家导航需要你的确认，空调操作将由程序权限规则裁决。",
  });
}

function createReadVehicleDecision(memories: Memory[]): StructuredAgentDecision {
  const calls: ProposedToolCall[] = [
    {
      callId: "read-vehicle-state",
      toolName: "getVehicleState",
      arguments: {},
    },
  ];

  return createDecision(memories, {
    intent: "read_vehicle_state",
    confidence: 1,
    goal: "读取当前车辆状态",
    plan: createPlan(calls),
    memoryReferences: [],
    proposedToolCalls: calls,
    clarificationNeeded: false,
    requiresConfirmation: false,
    responseDraft: "正在读取当前车辆状态。",
  });
}

export function createMockAgentDecision(
  input: string,
  context: VehicleContext,
  memories: Memory[],
): StructuredAgentDecision {
  const normalizedInput = normalizeInput(input);

  if (isScenario01Input(input)) {
    return createScenario01Decision(context, memories);
  }

  if (/^空调(?:调到)?24(?:℃|度)?就行$/.test(normalizedInput)) {
    return createScenario02Decision(memories);
  }

  if (/^回家(?:把)?空调(?:调到)?24(?:℃|度)?$/.test(normalizedInput)) {
    return createScenario03Decision(memories);
  }

  if (/^(?:查看|读取|查询)(?:当前)?车辆状态$/.test(normalizedInput)) {
    return createReadVehicleDecision(memories);
  }

  return createClarification(
    memories,
    "clarify",
    "请说明你希望执行的车内任务，例如读取车辆状态、设置空调或回家导航。",
  );
}
