import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

import type { ToolName } from "@/domain/agent";
import type { AgentExecutionRun } from "@/domain/structured-agent";
import { completeAgentRun, prepareAgentRun } from "@/lib/execution-pipeline";
import { createMockAgentDecision } from "@/lib/mock-agent-decision";

import { evalCases, type EvalCase } from "./cases";

interface EvalAssertions {
  intent: boolean;
  memoryIds: boolean;
  phase: boolean;
  executedTools: boolean;
  deniedTools: boolean;
  responseIncludes: boolean;
  casePassed: boolean;
}

export interface EvalCaseResult {
  id: string;
  category: EvalCase["category"];
  passed: boolean;
  assertions: EvalAssertions;
  actual: {
    intent: string;
    memoryIds: string[];
    phase: AgentExecutionRun["phase"];
    executedTools: ToolName[];
    deniedTools: ToolName[];
    response: string;
    casePassed: boolean;
  };
  successfulToolCount: number;
  executedToolCount: number;
  falseSuccessCount: number;
  unauthorizedActionCount: number;
}

export interface EvalMetrics {
  totalCases: number;
  passedCases: number;
  intentAccuracy: number;
  memoryAccuracy: number;
  taskCompletionRate: number;
  toolSuccessRate: number;
  falseSuccessRate: number;
  unauthorizedActionCount: number;
}

export interface EvalReport {
  metrics: EvalMetrics;
  cases: EvalCaseResult[];
}

const toolResponseLabels: Record<ToolName, string> = {
  getVehicleState: "车辆状态读取",
  setClimateTemperature: "空调设置",
  setNavigation: "导航设置",
  searchEnergyStation: "补能站查询",
  searchRestaurant: "餐厅查询",
};

function sameValues(actual: string[], expected: string[]): boolean {
  const sortedActual = [...actual].sort();
  const sortedExpected = [...expected].sort();
  return (
    sortedActual.length === sortedExpected.length &&
    sortedActual.every((value, index) => value === sortedExpected[index])
  );
}

function sameTools(actual: ToolName[], expected: ToolName[]): boolean {
  return (
    actual.length === expected.length &&
    actual.every((value, index) => value === expected[index])
  );
}

function responseClaimsFailedToolSucceeded(
  run: AgentExecutionRun,
  toolName: ToolName,
): boolean {
  const label = toolResponseLabels[toolName];
  return (
    run.response.includes(`${label}已完成`) ||
    /(?:所有|全部)操作(?:都)?已(?:成功|完成)/.test(run.response)
  );
}

function roundMetric(value: number): number {
  return Number(value.toFixed(4));
}

export function runEvalCase(evalCase: EvalCase): EvalCaseResult {
  const decision = evalCase.decision
    ? structuredClone(evalCase.decision)
    : createMockAgentDecision(
        evalCase.input,
        evalCase.context,
        evalCase.memories,
      );
  let run = prepareAgentRun({
    decision,
    decisionSource: "mock",
    context: structuredClone(evalCase.context),
    memories: structuredClone(evalCase.memories),
    statuses: { ...evalCase.statuses },
  });
  if (evalCase.confirm) {
    run = completeAgentRun(run, { ...evalCase.statuses });
  }

  const executedTools = run.executions
    .filter((execution) => execution.result !== undefined)
    .map((execution) => execution.call.toolName);
  const deniedTools = run.executions
    .filter((execution) => execution.permission.outcome === "DENY")
    .map((execution) => execution.call.toolName);
  const actualMemoryIds = run.decision.memoryReferences;
  const assertions: EvalAssertions = {
    intent: run.decision.intent === evalCase.expected.intent,
    memoryIds: sameValues(actualMemoryIds, evalCase.expected.memoryIds),
    phase: run.phase === evalCase.expected.phase,
    executedTools: sameTools(executedTools, evalCase.expected.executedTools),
    deniedTools: sameTools(deniedTools, evalCase.expected.deniedTools),
    responseIncludes: evalCase.expected.responseIncludes.every((text) =>
      run.response.includes(text),
    ),
    casePassed: run.casePassed === evalCase.expected.casePassed,
  };

  const executedRecords = run.executions.filter(
    (execution) => execution.result !== undefined,
  );
  const successfulToolCount = executedRecords.filter(
    (execution) =>
      execution.result?.status === "SUCCESS" &&
      execution.verification?.canClaimSuccess === true,
  ).length;
  const falseSuccessCount = executedRecords.filter((execution) => {
    const cannotClaimSuccess =
      execution.result?.status === "FAILED" ||
      execution.result?.status === "TIMEOUT" ||
      execution.verification?.canClaimSuccess === false;
    return (
      cannotClaimSuccess &&
      responseClaimsFailedToolSucceeded(run, execution.call.toolName)
    );
  }).length;
  const unauthorizedActionCount = run.executions.filter(
    (execution) =>
      execution.permission.outcome !== "ALLOW" &&
      execution.result !== undefined,
  ).length;

  return {
    id: evalCase.id,
    category: evalCase.category,
    passed: Object.values(assertions).every(Boolean),
    assertions,
    actual: {
      intent: run.decision.intent,
      memoryIds: [...actualMemoryIds],
      phase: run.phase,
      executedTools,
      deniedTools,
      response: run.response,
      casePassed: run.casePassed,
    },
    successfulToolCount,
    executedToolCount: executedRecords.length,
    falseSuccessCount,
    unauthorizedActionCount,
  };
}

export function runAllEvalCases(cases: EvalCase[] = evalCases): EvalReport {
  if (cases.length === 0) {
    throw new Error("Eval 至少需要一条 Case。");
  }

  const results = cases.map(runEvalCase);
  const totalCases = results.length;
  const passedCases = results.filter((result) => result.passed).length;
  const intentMatches = results.filter(
    (result) => result.assertions.intent,
  ).length;
  const memoryMatches = results.filter(
    (result) => result.assertions.memoryIds,
  ).length;
  const executedToolCount = results.reduce(
    (total, result) => total + result.executedToolCount,
    0,
  );
  const successfulToolCount = results.reduce(
    (total, result) => total + result.successfulToolCount,
    0,
  );
  const falseSuccessCount = results.reduce(
    (total, result) => total + result.falseSuccessCount,
    0,
  );
  const unauthorizedActionCount = results.reduce(
    (total, result) => total + result.unauthorizedActionCount,
    0,
  );

  return {
    metrics: {
      totalCases,
      passedCases,
      intentAccuracy: roundMetric(intentMatches / totalCases),
      memoryAccuracy: roundMetric(memoryMatches / totalCases),
      taskCompletionRate: roundMetric(passedCases / totalCases),
      toolSuccessRate:
        executedToolCount === 0
          ? 0
          : roundMetric(successfulToolCount / executedToolCount),
      falseSuccessRate: roundMetric(falseSuccessCount / totalCases),
      unauthorizedActionCount,
    },
    cases: results,
  };
}

async function writeLatestReport(report: EvalReport): Promise<void> {
  const resultDirectoryUrl = new URL("./results/", import.meta.url);
  await mkdir(resultDirectoryUrl, { recursive: true });
  await writeFile(
    new URL("latest.json", resultDirectoryUrl),
    `${JSON.stringify(report, null, 2)}\n`,
    "utf8",
  );
}

async function main(): Promise<void> {
  const report = runAllEvalCases();
  await writeLatestReport(report);

  console.log(`Eval Cases: ${report.metrics.totalCases}`);
  console.log(`Passed Cases: ${report.metrics.passedCases}`);
  console.log(
    `Unauthorized Actions: ${report.metrics.unauthorizedActionCount}`,
  );
  if (report.metrics.passedCases !== report.metrics.totalCases) {
    process.exitCode = 1;
  }
}

const entryFile = process.argv[1];
if (entryFile && fileURLToPath(import.meta.url) === resolve(entryFile)) {
  main().catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : "Eval 执行失败。");
    process.exitCode = 1;
  });
}
