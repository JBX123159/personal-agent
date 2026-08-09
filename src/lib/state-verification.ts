import type { ToolResult, VerificationRecord } from "@/domain/agent";
import type {
  ExecutionToolResult,
  ProposedToolCall,
  StructuredVerificationRecord,
} from "@/domain/structured-agent";

export function verifyToolResult(result: ToolResult): VerificationRecord {
  if (result.status === "SUCCESS") {
    return {
      tool: result.tool,
      verified: true,
      canClaimSuccess: true,
      message: "工具返回 SUCCESS，允许声明该步骤已完成。",
    };
  }

  if (result.status === "TIMEOUT") {
    return {
      tool: result.tool,
      verified: false,
      canClaimSuccess: false,
      message: "未收到状态确认，禁止把未知状态表述为成功。",
    };
  }

  return {
    tool: result.tool,
    verified: false,
    canClaimSuccess: false,
    message: "工具明确失败，禁止声明该步骤已完成。",
  };
}

export function verifyStructuredToolResult(
  call: ProposedToolCall,
  result: ExecutionToolResult,
): StructuredVerificationRecord {
  if (result.callId !== call.callId || result.tool !== call.toolName) {
    return {
      callId: call.callId,
      tool: call.toolName,
      verified: false,
      canClaimSuccess: false,
      message: "Tool Result 与调用标识不一致，禁止声明成功。",
    };
  }

  if (result.status === "TIMEOUT") {
    return {
      callId: call.callId,
      tool: call.toolName,
      verified: false,
      canClaimSuccess: false,
      message: "未收到状态确认，禁止把未知状态表述为成功。",
    };
  }

  if (result.status === "FAILED") {
    return {
      callId: call.callId,
      tool: call.toolName,
      verified: false,
      canClaimSuccess: false,
      message: "工具明确失败，禁止声明该步骤已完成。",
    };
  }

  if (call.expectedStateChange) {
    const mismatchedKey = Object.entries(call.expectedStateChange).find(
      ([key, expectedValue]) => !Object.is(result.data?.[key], expectedValue),
    )?.[0];

    if (mismatchedKey) {
      return {
        callId: call.callId,
        tool: call.toolName,
        verified: false,
        canClaimSuccess: false,
        message: `Tool 返回 SUCCESS，但观测字段 ${mismatchedKey} 与预期不一致。`,
      };
    }
  }

  return {
    callId: call.callId,
    tool: call.toolName,
    verified: true,
    canClaimSuccess: true,
    message: "工具结果与预期状态一致，允许声明该步骤已完成。",
  };
}
