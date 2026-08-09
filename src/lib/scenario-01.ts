import type {
  AgentDecision,
  Memory,
  PermissionDecision,
  ScenarioRun,
  ToolName,
  ToolResult,
  ToolStatus,
  VehicleContext,
} from "@/domain/agent";
import { validateAgentDecision } from "@/lib/agent-decision-schema";
import { runMockTool } from "@/lib/mock-tools";
import { evaluatePermission } from "@/lib/permission-engine";
import { selectScenario01Memories } from "@/lib/scenario-01-memory";
import { verifyToolResult } from "@/lib/state-verification";

type ToolStatuses = Record<ToolName, ToolStatus>;

function runReadTool(
  tool: ToolName,
  context: VehicleContext,
  statuses: ToolStatuses,
): { permission: PermissionDecision; result: ToolResult } {
  const permission = evaluatePermission({ tool });
  if (!permission.allowed) {
    throw new Error(`READ 工具 ${tool} 被 Permission Engine 意外拦截。`);
  }
  return {
    permission,
    result: runMockTool(tool, statuses[tool], { context }),
  };
}

function createConfirmationMessage(
  results: ToolResult[],
  context: VehicleContext,
): string {
  const energy = results.find((result) => result.tool === "searchEnergyStation");
  const restaurant = results.find((result) => result.tool === "searchRestaurant");

  if (energy?.status === "SUCCESS" && restaurant?.status === "SUCCESS") {
    return `好的，按你平时周五的安排，我先准备去健身。今天电量${context.batteryLevel}%，最近的补能站目前满了，另一个可用站会多8分钟；另外你常去的A餐厅今晚没有营业，我找到了两个相近选择。要先按健身＋补能的方案走吗？`;
  }

  const energyText = energy
    ? energy.status === "TIMEOUT"
      ? "补能站查询暂时没有返回"
      : energy.status === "FAILED"
        ? "补能站查询失败"
        : energy.message
    : "当前电量不需要插入补能安排";
  const restaurantText = restaurant
    ? restaurant.status === "SUCCESS"
      ? restaurant.message
      : "餐厅状态目前无法确认"
    : "未查询餐厅";
  const energySummary = energyText.replace(/[。；;]+$/, "");
  const restaurantSummary = restaurantText.replace(/[。；;]+$/, "");

  return `我识别到你平时的周五健身安排。${energySummary}；${restaurantSummary}。现有信息不完整，我不会直接执行导航，你仍要按当前可用方案继续吗？`;
}

function assertDecision(decision: AgentDecision): AgentDecision {
  if (!validateAgentDecision(decision)) {
    throw new Error("Mock Agent Decision 未通过结构校验。 ");
  }
  return decision;
}

export function prepareScenario01(
  context: VehicleContext,
  memories: Memory[],
  statuses: ToolStatuses,
): ScenarioRun {
  const contextSnapshot = { ...context };
  const relevantMemories = selectScenario01Memories(contextSnapshot, memories);
  const hasRoutine = relevantMemories.some(
    (memory) => memory.id === "friday_gym",
  );

  if (!hasRoutine) {
    const response =
      "当前时间或地点与已记录的周五下班 Routine 不匹配。为了避免误用 Memory，我需要先确认你说的“老样子”具体指什么。";
    const decision = assertDecision({
      intent: "reuse_routine",
      confidence: 0.52,
      relevantMemoryIds: relevantMemories.map((memory) => memory.id),
      goal: "在 Context 匹配后复用晚间 Routine",
      plan: [],
      clarificationNeeded: true,
      confirmationRequired: false,
      response,
    });
    return {
      phase: "completed",
      contextSnapshot,
      relevantMemories,
      decision,
      permissions: [],
      toolResults: [],
      verifications: [],
      response,
      falseSuccessPrevented: true,
      casePassed: false,
    };
  }

  const readTools: ToolName[] = ["getVehicleState", "searchRestaurant"];
  if (contextSnapshot.batteryLevel < 20) {
    readTools.splice(1, 0, "searchEnergyStation");
  }

  const readExecutions = readTools.map((tool) =>
    runReadTool(tool, contextSnapshot, statuses),
  );
  const toolResults = readExecutions.map(({ result }) => result);
  const confirmationMessage = createConfirmationMessage(
    toolResults,
    contextSnapshot,
  );
  const hasClimatePreference = relevantMemories.some(
    (memory) => memory.id === "summer_climate_24",
  );

  const decision = assertDecision({
    intent: "reuse_routine",
    confidence: 0.97,
    relevantMemoryIds: relevantMemories.map((memory) => memory.id),
    goal: "完成周五晚间 Routine，并根据实时状态安全调整方案",
    plan: [
      { action: "读取当前车辆状态", tool: "getVehicleState", risk: "read" },
      { action: "保留用户平时的健身安排", risk: "read" },
      ...(contextSnapshot.batteryLevel < 20
        ? [
            {
              action: "查询并改用可用补能站",
              tool: "searchEnergyStation" as const,
              risk: "read" as const,
            },
          ]
        : []),
      { action: "查询 A 餐厅并准备可用备选", tool: "searchRestaurant", risk: "read" },
      { action: "一次性请求执行方案确认", risk: "high" },
      {
        action:
          contextSnapshot.batteryLevel < 20
            ? "设置健身、补能和备选餐厅导航"
            : "设置健身和备选餐厅导航",
        tool: "setNavigation",
        risk: "high",
      },
      ...(hasClimatePreference
        ? [
            {
              action: "按已授权偏好设置 24℃",
              tool: "setClimateTemperature" as const,
              risk: "low" as const,
            },
          ]
        : []),
    ],
    clarificationNeeded: false,
    confirmationRequired: true,
    confirmationMessage,
    response: confirmationMessage,
  });

  const navigationPermission = evaluatePermission({ tool: "setNavigation" });
  const climatePermission = hasClimatePreference
    ? evaluatePermission({
        tool: "setClimateTemperature",
        userAuthorized: true,
        reversible: true,
      })
    : undefined;

  return {
    phase: "awaiting_confirmation",
    contextSnapshot,
    relevantMemories,
    decision,
    permissions: [
      ...readExecutions.map(({ permission }) => permission),
      navigationPermission,
      ...(climatePermission ? [climatePermission] : []),
    ],
    toolResults,
    verifications: toolResults.map(verifyToolResult),
    response: confirmationMessage,
    falseSuccessPrevented: true,
    casePassed: false,
  };
}

function buildCompletionResponse(
  results: ToolResult[],
  needsEnergyStop: boolean,
): string {
  const navigation = results.find((result) => result.tool === "setNavigation");
  const climate = results.find(
    (result) => result.tool === "setClimateTemperature",
  );

  const routeLabel = needsEnergyStop
    ? "健身、可用补能站和备选餐厅"
    : "健身和备选餐厅";

  if (navigation?.status === "SUCCESS" && climate?.status === "SUCCESS") {
    return `已完成：${routeLabel}的导航已设置，空调已调整到24℃。`;
  }
  if (navigation?.status === "SUCCESS" && !climate) {
    return `已完成：${routeLabel}的导航已设置。`;
  }
  if (navigation?.status === "SUCCESS" && climate?.status === "FAILED") {
    return "导航已经设置好了，不过空调调整没有成功。我没有把失败步骤算作完成。";
  }
  if (navigation?.status === "SUCCESS" && climate?.status === "TIMEOUT") {
    return "导航已经设置好了；空调控制暂时没有返回确认，我还不能确定是否调整成功。";
  }
  if (navigation?.status === "FAILED") {
    return climate?.status === "SUCCESS"
      ? "空调已调整到24℃，但导航设置失败，因此本次方案尚未全部完成。"
      : "导航设置失败，本次方案没有完成；我不会把它表述为成功。";
  }
  if (navigation?.status === "TIMEOUT") {
    return "导航暂时没有返回确认，我还不能确定方案是否执行成功。";
  }
  return "没有可执行的写操作，本次未改变车辆状态。";
}

export function completeScenario01(
  currentRun: ScenarioRun,
  statuses: ToolStatuses,
): ScenarioRun {
  if (currentRun.phase !== "awaiting_confirmation") return currentRun;

  const navigationPermission = evaluatePermission({
    tool: "setNavigation",
    userConfirmed: true,
  });
  const writeResults: ToolResult[] = [];
  const needsEnergyStop = currentRun.contextSnapshot.batteryLevel < 20;

  if (navigationPermission.allowed) {
    writeResults.push(
      runMockTool("setNavigation", statuses.setNavigation, {
        context: currentRun.contextSnapshot,
        destination: needsEnergyStop
          ? "健身 → 第二补能站 → B 餐厅"
          : "健身 → B 餐厅",
      }),
    );
  }

  const hasClimatePreference = currentRun.relevantMemories.some(
    (memory) => memory.id === "summer_climate_24",
  );
  const climatePermission = hasClimatePreference
    ? evaluatePermission({
        tool: "setClimateTemperature",
        userAuthorized: true,
        reversible: true,
      })
    : undefined;

  if (climatePermission?.allowed) {
    writeResults.push(
      runMockTool("setClimateTemperature", statuses.setClimateTemperature, {
        context: currentRun.contextSnapshot,
        temperature: 24,
      }),
    );
  }

  const allResults = [...currentRun.toolResults, ...writeResults];
  const verifications = allResults.map(verifyToolResult);
  const response = buildCompletionResponse(writeResults, needsEnergyStop);
  const allWritesVerified = writeResults.every(
    (result) => result.status === "SUCCESS",
  );

  return {
    ...currentRun,
    phase: "completed",
    permissions: [
      ...currentRun.permissions.filter(
        (permission) =>
          permission.tool !== "setNavigation" &&
          permission.tool !== "setClimateTemperature",
      ),
      navigationPermission,
      ...(climatePermission ? [climatePermission] : []),
    ],
    toolResults: allResults,
    verifications,
    response,
    falseSuccessPrevented: verifications.every(
      (record) => record.canClaimSuccess === record.verified,
    ),
    casePassed: allWritesVerified && navigationPermission.allowed,
  };
}
