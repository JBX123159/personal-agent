export type PassengerMode = "owner_only" | "guest";

export interface VehicleContext {
  currentTime: string;
  location: string;
  batteryLevel: number;
  passengerMode: PassengerMode;
  cabinTemperature: number;
  weather: string;
  currentRoute?: string;
}

export type MemoryType = "preference" | "routine" | "temporary";
export type MemorySensitivity = "low" | "medium" | "high";
export type MemorySource =
  | "explicit"
  | "repeated_behavior"
  | "agent_inference";
export type MemoryStatus =
  | "temporary"
  | "candidate"
  | "active"
  | "suspended"
  | "deleted";

export interface Memory {
  id: string;
  type: MemoryType;
  content: string;
  context?: Record<string, unknown>;
  confidence: number;
  sensitivity: MemorySensitivity;
  source: MemorySource;
  status: MemoryStatus;
  userConfirmed: boolean;
  observationCount: number;
}

export type ToolName =
  | "getVehicleState"
  | "setClimateTemperature"
  | "setNavigation"
  | "searchEnergyStation"
  | "searchRestaurant";

export type ToolStatus = "SUCCESS" | "FAILED" | "TIMEOUT";
export type DecisionRisk = "read" | "low" | "high";

export interface AgentDecision {
  intent: string;
  confidence: number;
  relevantMemoryIds: string[];
  goal: string;
  plan: {
    action: string;
    tool?: ToolName;
    risk: DecisionRisk;
  }[];
  clarificationNeeded: boolean;
  confirmationRequired: boolean;
  confirmationMessage?: string;
  response: string;
}

export interface ToolResult {
  tool: ToolName;
  status: ToolStatus;
  message: string;
  data?: Record<string, unknown>;
}

export interface PermissionDecision {
  tool: ToolName;
  risk: DecisionRisk;
  allowed: boolean;
  requiresConfirmation: boolean;
  reason: string;
}

export interface VerificationRecord {
  tool: ToolName;
  verified: boolean;
  canClaimSuccess: boolean;
  message: string;
}

export type ScenarioPhase =
  | "idle"
  | "awaiting_confirmation"
  | "completed";

export interface ScenarioRun {
  phase: ScenarioPhase;
  contextSnapshot: VehicleContext;
  relevantMemories: Memory[];
  decision: AgentDecision;
  permissions: PermissionDecision[];
  toolResults: ToolResult[];
  verifications: VerificationRecord[];
  response: string;
  falseSuccessPrevented: boolean;
  casePassed: boolean;
}

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
}
