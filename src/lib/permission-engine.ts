import type {
  DecisionRisk,
  PermissionDecision,
  ToolName,
} from "@/domain/agent";
import type {
  PermissionEvaluation,
  ProposedToolCall,
} from "@/domain/structured-agent";

const toolRiskMap: Record<ToolName, DecisionRisk> = {
  getVehicleState: "read",
  searchEnergyStation: "read",
  searchRestaurant: "read",
  setClimateTemperature: "low",
  setNavigation: "high",
};

interface PermissionInput {
  tool: ToolName;
  userAuthorized?: boolean;
  reversible?: boolean;
  userConfirmed?: boolean;
}

export interface StructuredPermissionInput {
  call: ProposedToolCall;
  userAuthorized: boolean;
  reversible: boolean;
  userConfirmed: boolean;
}

export function evaluatePermission({
  tool,
  userAuthorized = false,
  reversible = false,
  userConfirmed = false,
}: PermissionInput): PermissionDecision {
  const risk = toolRiskMap[tool];

  if (risk === "read") {
    return {
      tool,
      risk,
      allowed: true,
      requiresConfirmation: false,
      reason: "READ 工具只读取信息，允许直接执行。",
    };
  }

  if (risk === "low") {
    const allowed = userAuthorized && reversible;
    return {
      tool,
      risk,
      allowed,
      requiresConfirmation: !allowed,
      reason: allowed
        ? "用户已授权且操作可逆，允许执行。"
        : "缺少用户授权或操作不可逆，不能自动执行。",
    };
  }

  return {
    tool,
    risk,
    allowed: userConfirmed,
    requiresConfirmation: !userConfirmed,
    reason: userConfirmed
      ? "高影响操作已获得本轮明确确认。"
      : "高影响操作必须等待用户明确确认。",
  };
}

export function evaluateStructuredPermission({
  call,
  userAuthorized,
  reversible,
  userConfirmed,
}: StructuredPermissionInput): PermissionEvaluation {
  const risk = toolRiskMap[call.toolName];

  if (risk === "read") {
    return {
      callId: call.callId,
      tool: call.toolName,
      risk,
      outcome: "ALLOW",
      allowed: true,
      requiresConfirmation: false,
      reason: "读取类工具只获取信息，程序允许直接执行。",
    };
  }

  if (risk === "low") {
    const allowed = userAuthorized && reversible;
    return {
      callId: call.callId,
      tool: call.toolName,
      risk,
      outcome: allowed ? "ALLOW" : "DENY",
      allowed,
      requiresConfirmation: false,
      reason: allowed
        ? "已引用用户确认的有效偏好，且操作可撤销。"
        : "没有有效授权，或操作不可撤销，程序拒绝执行。",
    };
  }

  return {
    callId: call.callId,
    tool: call.toolName,
    risk,
    outcome: userConfirmed ? "ALLOW" : "REQUIRE_CONFIRMATION",
    allowed: userConfirmed,
    requiresConfirmation: !userConfirmed,
    reason: userConfirmed
      ? "高风险操作已获得本轮明确确认。"
      : "高风险操作必须等待用户明确确认。",
  };
}
