import type {
  ToolName,
  ToolResult,
  ToolStatus,
  VehicleContext,
} from "@/domain/agent";
import type {
  ExecutionToolResult,
  ProposedToolCall,
} from "@/domain/structured-agent";

interface ToolInput {
  context: VehicleContext;
  destination?: string;
  temperature?: number;
}

const failureMessages: Record<Exclude<ToolStatus, "SUCCESS">, string> = {
  FAILED: "工具执行失败，未产生可验证的状态变化。",
  TIMEOUT: "工具暂时没有返回确认，当前状态未知。",
};

export function runMockTool(
  tool: ToolName,
  status: ToolStatus,
  input: ToolInput,
): ToolResult {
  if (status !== "SUCCESS") {
    return { tool, status, message: failureMessages[status] };
  }

  switch (tool) {
    case "getVehicleState":
      return {
        tool,
        status,
        message: "已读取当前车辆状态。",
        data: { ...input.context },
      };
    case "searchEnergyStation":
      return {
        tool,
        status,
        message: "最近补能站已满，第二补能站可用且多 8 分钟。",
        data: {
          nearest: "FULL",
          alternative: "AVAILABLE",
          extraMinutes: 8,
        },
      };
    case "searchRestaurant":
      return {
        tool,
        status,
        message: "A 餐厅已关闭，B 餐厅和 C 餐厅可用。",
        data: {
          preferred: "CLOSED",
          alternatives: ["B 餐厅", "C 餐厅"],
        },
      };
    case "setNavigation":
      return {
        tool,
        status,
        message: `导航已设置：${input.destination ?? "健身＋补能＋备选餐厅"}。`,
        data: { destination: input.destination ?? "健身＋补能＋备选餐厅" },
      };
    case "setClimateTemperature":
      return {
        tool,
        status,
        message: `座舱温度已设置为 ${input.temperature ?? 24}℃。`,
        data: { temperature: input.temperature ?? 24 },
      };
    default: {
      const exhaustiveCheck: never = tool;
      throw new Error(`未定义的 Mock Tool：${exhaustiveCheck}`);
    }
  }
}

function failedStructuredResult(
  call: ProposedToolCall,
  message: string,
): ExecutionToolResult {
  return {
    callId: call.callId,
    tool: call.toolName,
    status: "FAILED",
    message,
  };
}

export function runStructuredMockTool(
  call: ProposedToolCall,
  status: ToolStatus,
  context: VehicleContext,
): ExecutionToolResult {
  if (status !== "SUCCESS") {
    return {
      callId: call.callId,
      tool: call.toolName,
      status,
      message: failureMessages[status],
    };
  }

  switch (call.toolName) {
    case "getVehicleState":
      return {
        callId: call.callId,
        tool: call.toolName,
        status,
        message: "已读取当前车辆状态。",
        data: { ...context },
      };
    case "searchEnergyStation":
      return {
        callId: call.callId,
        tool: call.toolName,
        status,
        message: "最近补能站已满，第二补能站可用且多 8 分钟。",
        data: {
          nearest: "FULL",
          alternative: "AVAILABLE",
          extraMinutes: 8,
        },
      };
    case "searchRestaurant":
      return {
        callId: call.callId,
        tool: call.toolName,
        status,
        message: "A 餐厅已关闭，B 餐厅和 C 餐厅可用。",
        data: {
          preferred: "CLOSED",
          alternatives: ["B 餐厅", "C 餐厅"],
        },
      };
    case "setNavigation": {
      const destination = call.arguments.destination;
      if (typeof destination !== "string" || destination.trim() === "") {
        return failedStructuredResult(call, "导航目的地参数无效，未执行操作。");
      }
      return {
        callId: call.callId,
        tool: call.toolName,
        status,
        message: `导航已设置：${destination}。`,
        data: { destination },
      };
    }
    case "setClimateTemperature": {
      const temperature = call.arguments.temperature;
      if (typeof temperature !== "number" || !Number.isFinite(temperature)) {
        return failedStructuredResult(call, "空调温度参数无效，未执行操作。");
      }
      return {
        callId: call.callId,
        tool: call.toolName,
        status,
        message: `座舱温度已设置为 ${temperature}℃。`,
        data: { temperature },
      };
    }
    default: {
      const exhaustiveCheck: never = call.toolName;
      throw new Error(`未定义的 Structured Mock Tool：${exhaustiveCheck}`);
    }
  }
}
