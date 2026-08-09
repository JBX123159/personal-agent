import type {
  DecisionRisk,
  Memory,
  ToolName,
  ToolStatus,
  VehicleContext,
} from "./agent";

export interface AgentPlanStep {
  stepId: string;
  description: string;
  toolName?: ToolName;
}

export interface ProposedToolCall {
  callId: string;
  toolName: ToolName;
  arguments: Record<string, unknown>;
  expectedStateChange?: Record<string, unknown>;
}

export interface StructuredAgentDecision {
  schemaVersion: "1.0";
  intent: string;
  confidence: number;
  goal: string;
  plan: AgentPlanStep[];
  memoryReferences: string[];
  proposedToolCalls: ProposedToolCall[];
  clarificationNeeded: boolean;
  requiresConfirmation: boolean;
  confirmationPrompt?: string;
  responseDraft: string;
}

export interface AgentDecisionRequest {
  userInput: string;
  context: VehicleContext;
  memories: Memory[];
}

export type PermissionOutcome = "ALLOW" | "REQUIRE_CONFIRMATION" | "DENY";

export interface PermissionEvaluation {
  callId: string;
  tool: ToolName;
  risk: DecisionRisk;
  outcome: PermissionOutcome;
  allowed: boolean;
  requiresConfirmation: boolean;
  reason: string;
}

export interface ExecutionToolResult {
  callId: string;
  tool: ToolName;
  status: ToolStatus;
  message: string;
  data?: Record<string, unknown>;
}

export interface StructuredVerificationRecord {
  callId: string;
  tool: ToolName;
  verified: boolean;
  canClaimSuccess: boolean;
  message: string;
}

export interface ToolExecutionRecord {
  call: ProposedToolCall;
  permission: PermissionEvaluation;
  result?: ExecutionToolResult;
  verification?: StructuredVerificationRecord;
}

export interface AgentExecutionRun {
  phase: "awaiting_confirmation" | "completed";
  decisionSource: "agnes" | "mock";
  contextSnapshot: VehicleContext;
  relevantMemories: Memory[];
  decision: StructuredAgentDecision;
  executions: ToolExecutionRecord[];
  pendingToolCalls: ProposedToolCall[];
  response: string;
  falseSuccessPrevented: boolean;
  casePassed: boolean;
}
