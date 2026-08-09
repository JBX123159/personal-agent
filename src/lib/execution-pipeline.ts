import type {
  Memory,
  ToolName,
  ToolStatus,
  VehicleContext,
} from "@/domain/agent";
import type {
  AgentExecutionRun,
  ProposedToolCall,
  StructuredAgentDecision,
  ToolExecutionRecord,
} from "@/domain/structured-agent";
import { runStructuredMockTool } from "@/lib/mock-tools";
import { evaluateStructuredPermission } from "@/lib/permission-engine";
import { composeExecutionResponse } from "@/lib/response-composer";
import { verifyStructuredToolResult } from "@/lib/state-verification";

export interface PrepareAgentRunInput {
  decision: StructuredAgentDecision;
  decisionSource: "agnes" | "mock";
  context: VehicleContext;
  memories: Memory[];
  statuses: Record<ToolName, ToolStatus>;
}

function readMemoryTemperature(memory: Memory): number | undefined {
  const contextTemperature = memory.context?.temperature;
  if (
    typeof contextTemperature === "number" &&
    Number.isFinite(contextTemperature)
  ) {
    return contextTemperature;
  }

  const contentMatch = memory.content.match(/(-?\d+(?:\.\d+)?)\s*(?:℃|度)/);
  if (!contentMatch) return undefined;

  const contentTemperature = Number(contentMatch[1]);
  return Number.isFinite(contentTemperature) ? contentTemperature : undefined;
}

function memoryMatchesContext(
  memory: Memory,
  context: VehicleContext,
): boolean {
  const memoryPassengerMode = memory.context?.passengerMode;
  return (
    memoryPassengerMode === undefined ||
    memoryPassengerMode === context.passengerMode
  );
}

function isClimateAuthorized(
  call: ProposedToolCall,
  decision: StructuredAgentDecision,
  memories: Memory[],
  context: VehicleContext,
): boolean {
  if (call.toolName !== "setClimateTemperature") return false;

  const requestedTemperature = call.arguments.temperature;
  if (
    typeof requestedTemperature !== "number" ||
    !Number.isFinite(requestedTemperature)
  ) {
    return false;
  }

  const referencedIds = new Set(decision.memoryReferences);
  return memories.some(
    (memory) =>
      referencedIds.has(memory.id) &&
      memory.status === "active" &&
      memory.userConfirmed &&
      memory.type === "preference" &&
      readMemoryTemperature(memory) === requestedTemperature &&
      memoryMatchesContext(memory, context),
  );
}

function createExecutionRecord(
  call: ProposedToolCall,
  decision: StructuredAgentDecision,
  memories: Memory[],
  context: VehicleContext,
  userConfirmed: boolean,
): ToolExecutionRecord {
  return {
    call,
    permission: evaluateStructuredPermission({
      call,
      userAuthorized: isClimateAuthorized(call, decision, memories, context),
      reversible: call.toolName === "setClimateTemperature",
      userConfirmed,
    }),
  };
}

function executeRecord(
  record: ToolExecutionRecord,
  status: ToolStatus,
  context: VehicleContext,
): ToolExecutionRecord {
  if (record.permission.outcome !== "ALLOW") return record;

  const result = runStructuredMockTool(record.call, status, context);
  return {
    ...record,
    result,
    verification: verifyStructuredToolResult(record.call, result),
  };
}

function withComposedResponse(
  run: Omit<AgentExecutionRun, "response" | "falseSuccessPrevented" | "casePassed">,
): AgentExecutionRun {
  const composed = composeExecutionResponse(run.executions);
  return { ...run, ...composed };
}

export function prepareAgentRun(
  input: PrepareAgentRunInput,
): AgentExecutionRun {
  const callIds = input.decision.proposedToolCalls.map((call) => call.callId);
  if (new Set(callIds).size !== callIds.length) {
    throw new Error("AgentDecision 的 callId 必须唯一。");
  }

  let executions = input.decision.proposedToolCalls.map((call) =>
    createExecutionRecord(
      call,
      input.decision,
      input.memories,
      input.context,
      false,
    ),
  );
  const requiresConfirmation = executions.some(
    (record) => record.permission.outcome === "REQUIRE_CONFIRMATION",
  );

  executions = executions.map((record) => {
    if (record.permission.risk === "read") {
      return executeRecord(
        record,
        input.statuses[record.call.toolName],
        input.context,
      );
    }

    if (requiresConfirmation || record.permission.outcome !== "ALLOW") {
      return record;
    }

    return executeRecord(
      record,
      input.statuses[record.call.toolName],
      input.context,
    );
  });

  const pendingToolCalls = requiresConfirmation
    ? executions
        .filter(
          (record) =>
            record.permission.risk !== "read" &&
            record.permission.outcome !== "DENY",
        )
        .map((record) => record.call)
    : [];

  if (input.decision.proposedToolCalls.length === 0) {
    return {
      phase: "completed",
      decisionSource: input.decisionSource,
      contextSnapshot: input.context,
      relevantMemories: input.memories,
      decision: input.decision,
      executions,
      pendingToolCalls,
      response: input.decision.clarificationNeeded
        ? input.decision.responseDraft
        : "没有需要执行的工具操作。",
      falseSuccessPrevented: false,
      casePassed: false,
    };
  }

  return withComposedResponse({
    phase: requiresConfirmation ? "awaiting_confirmation" : "completed",
    decisionSource: input.decisionSource,
    contextSnapshot: input.context,
    relevantMemories: input.memories,
    decision: input.decision,
    executions,
    pendingToolCalls,
  });
}

export function completeAgentRun(
  run: AgentExecutionRun,
  statuses: Record<ToolName, ToolStatus>,
): AgentExecutionRun {
  if (run.phase !== "awaiting_confirmation") return run;

  const pendingIds = new Set(run.pendingToolCalls.map((call) => call.callId));
  const executions = run.executions.map((record) => {
    if (!pendingIds.has(record.call.callId)) return record;

    const confirmedRecord = createExecutionRecord(
      record.call,
      run.decision,
      run.relevantMemories,
      run.contextSnapshot,
      true,
    );
    return executeRecord(
      confirmedRecord,
      statuses[record.call.toolName],
      run.contextSnapshot,
    );
  });

  return withComposedResponse({
    ...run,
    phase: "completed",
    executions,
    pendingToolCalls: [],
  });
}
