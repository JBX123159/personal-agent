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

export function createEvalCase(
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

export function expectation(
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

export const activeCandidateMemories = createScenario02Memories(
  "active",
  true,
);

export { createScenario02Memories };
