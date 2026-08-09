import type { ToolName } from "@/domain/agent";
import type { ToolExecutionRecord } from "@/domain/structured-agent";

const toolResponseLabels: Record<ToolName, string> = {
  getVehicleState: "车辆状态读取",
  setClimateTemperature: "空调设置",
  setNavigation: "导航设置",
  searchEnergyStation: "补能站查询",
  searchRestaurant: "餐厅查询",
};

export function composeExecutionResponse(
  executions: ToolExecutionRecord[],
): {
  response: string;
  falseSuccessPrevented: boolean;
  casePassed: boolean;
} {
  if (executions.length === 0) {
    return {
      response: "没有需要执行的工具操作。",
      falseSuccessPrevented: false,
      casePassed: false,
    };
  }

  let completedCount = 0;
  let falseSuccessPrevented = false;
  const facts = executions.map((execution) => {
    const label = toolResponseLabels[execution.call.toolName];

    if (execution.permission.outcome === "DENY") {
      return `${label}已被权限规则阻止`;
    }

    if (execution.permission.outcome === "REQUIRE_CONFIRMATION") {
      return `${label}正在等待用户确认`;
    }

    if (!execution.result) {
      return `${label}尚未执行`;
    }

    if (execution.result.status === "FAILED") {
      falseSuccessPrevented = true;
      return `${label}执行失败`;
    }

    if (execution.result.status === "TIMEOUT") {
      falseSuccessPrevented = true;
      return `${label}结果未知，未收到确认`;
    }

    if (!execution.verification?.canClaimSuccess) {
      falseSuccessPrevented = true;
      return `${label}返回成功但状态验证不一致`;
    }

    completedCount += 1;
    return `${label}已完成`;
  });

  const casePassed = completedCount === executions.length;
  const hasPartialSuccess = completedCount > 0 && !casePassed;

  return {
    response: `${hasPartialSuccess ? "部分成功：" : ""}${facts.join("；")}。`,
    falseSuccessPrevented,
    casePassed,
  };
}
