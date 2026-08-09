# Agnes Structured Personal Agent Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在现有三栏车载 Personal Agent Demo 中接入 Agnes 真实结构化决策，同时由程序完成权限裁决、Mock Tool 执行、状态验证、Memory 生命周期和 15 条确定性 Eval。

**Architecture:** Agnes 只通过强制 `submit_agent_decision` 函数调用返回结构化决策；服务端验证后，前端统一 Pipeline 调用确定性 Permission Engine、五个 Mock Tool 和 State Verification。Memory 保留在浏览器会话内，Eval 复用同一套纯函数，不使用 LLM 评分。

**Tech Stack:** Next.js 16.3.0、React 19.2.8、TypeScript 5、Tailwind CSS 4、shadcn/ui、原生 `fetch`、`tsx`、Node.js `node:test`

## Global Constraints

- 所有命令均在项目根目录运行。
- Agnes 模型固定为 `agnes-2.5-flash`，Base URL 固定为 `https://apihub.agnes-ai.com/v1`。
- API Key 只从服务端环境变量 `AGNES_API_KEY` 读取，不进入客户端代码、日志或 Git。
- Agnes 只能提出结构化决策，不能直接执行 Mock Tool；Permission Engine 的结论始终覆盖 LLM。
- 只保留现有五个 Mock Tool，不接入真实汽车、地图、餐厅或补能接口。
- 不增加 RAG、Vector DB、MCP、Multi-Agent、数据库、登录或云端 Memory。
- Memory 仅保存在当前浏览器会话，刷新页面可以重置。
- Tool `FAILED`、`TIMEOUT` 或 Verification 不通过时，最终回复不得声称对应动作成功。
- 只修改本轮需求需要的文件，不全局重构，不重新设计三栏整体视觉。
- 每个任务完成后运行对应测试并单独提交；任何失败先修复再进入下一任务。

---

## File Structure

### 新增文件

- `src/app/api/agent/decision/route.ts`：校验客户端请求、调用 Agnes、隐藏上游错误细节。
- `src/domain/structured-agent.ts`：承载 Structured Decision 和新执行流水线类型，不提前破坏 Phase 1 类型。
- `src/lib/agnes-client.ts`：构造 Agnes 请求、20 秒超时、解析强制函数调用。
- `src/lib/agnes-client.test.ts`：覆盖成功解析、超时、缺少 Key、非法函数参数。
- `src/lib/agent-decision-schema.test.ts`：覆盖 Structured Decision 和 Tool 参数校验。
- `src/lib/memory-engine.ts`：观察偏好、Candidate、Active、Pause、Resume、Forget 和相关 Memory 过滤。
- `src/lib/memory-engine.test.ts`：覆盖完整 Memory 生命周期。
- `src/lib/response-composer.ts`：只根据 Permission、Tool Result 和 Verification 生成最终回复。
- `src/lib/execution-pipeline.ts`：统一准备、确认和执行流程。
- `src/lib/execution-pipeline.test.ts`：覆盖权限覆盖、失败、超时、部分成功和验证不一致。
- `src/lib/mock-agent-decision.ts`：保留 Phase 1 Mock 模式并支持三个演示场景。
- `eval/cases.ts`：15 条固定 Eval Case。
- `eval/run-eval.ts`：执行 Case、统计指标、写入结果。
- `eval/results/latest.json`：当前固定 Eval 结果。
- `.env.example`：Agnes Key 占位配置。

### 修改文件

- `src/domain/agent.ts:18-42`：仅在 Memory 任务中增加生命周期计数，保留 Phase 1 类型供旧演示逻辑编译。
- `src/lib/agent-decision-schema.ts:1-31`：增加 JSON Schema、请求校验和严格运行时解析。
- `src/lib/permission-engine.ts:1-66`：返回 `ALLOW / REQUIRE_CONFIRMATION / DENY`，风险只由程序映射。
- `src/lib/mock-tools.ts:1-73`：按结构化 Tool Call 执行并保留 `callId`。
- `src/lib/state-verification.ts:1-29`：比较 `expectedStateChange` 和 Tool 观测数据。
- `src/lib/scenario-01.ts:1-239`：改为生成 Mock Decision 并复用统一 Pipeline。
- `src/components/agent/agent-demo.tsx:1-176`：接入 Agnes API、模式选择、Memory 状态和统一 Pipeline。
- `src/components/agent/chat-panel.tsx:1-139`：显示 Agnes/Mock 模式、请求错误和重试入口。
- `src/components/agent/inspector-panel.tsx:1-81`：向 Memory Inspector 传入全量 Memory 和操作回调。
- `src/components/agent/inspector-sections.tsx:1-276`：展示 Structured Decision、Permission Outcome、Memory 控件和验证结果。
- `src/data/mock-data.ts:1-78`：补齐 `observationCount` 和安全克隆工厂。
- `package.json`：增加 typecheck、test、eval 命令和 `tsx` 开发依赖。
- `.gitignore`：允许提交 `.env.example`。
- `README.md`：替换默认脚手架说明。

---

### Task 1: 保存可回退的 Phase 1 基线

**Files:**
- Add to Git without content changes: `.gitignore`, `AGENTS.md`, `CLAUDE.md`, `README.md`, `components.json`, `eslint.config.mjs`, `next.config.ts`, `package-lock.json`, `package.json`, `postcss.config.mjs`, `public/*`, `src/*`, `tsconfig.json`

**Interfaces:**
- Consumes: 当前未跟踪但已通过 Phase 1 验证的项目文件。
- Produces: 一个独立 Phase 1 基线提交，后续所有功能提交都可单独审阅和回退。

- [ ] **Step 1: 核对只提交当前项目文件**

Run:

```powershell
git status --short
git diff --cached --name-only
```

Expected: 设计文档已经提交；项目文件显示 `??`；暂存区为空。

- [ ] **Step 2: 验证 Phase 1 基线**

Run:

```powershell
npm exec tsc -- --noEmit
npm run lint
npm run build
```

Expected: 三条命令退出码均为 `0`，Next.js production build 完成。

- [ ] **Step 3: 提交基线**

Run:

```powershell
git add -- .gitignore AGENTS.md CLAUDE.md README.md components.json eslint.config.mjs next.config.ts package-lock.json package.json postcss.config.mjs public src tsconfig.json
git diff --cached --check
git commit -m "feat: preserve phase 1 personal agent baseline"
```

Expected: 提交成功，`git status --short` 为空。

---

### Task 2: 建立轻量测试入口和独立的严格 AgentDecision Schema

**Files:**
- Modify: `package.json`
- Modify: `package-lock.json`
- Create: `src/domain/structured-agent.ts`
- Modify: `src/lib/agent-decision-schema.ts:1-31`
- Create: `src/lib/agent-decision-schema.test.ts`

**Interfaces:**
- Consumes: 现有 `VehicleContext`、`Memory`、`ToolName`、`ToolStatus`。
- Produces: `StructuredAgentDecision`、`ProposedToolCall`、`AgentExecutionRun`、`parseAgentDecision(value, allowedMemoryIds)`、`parseAgentDecisionRequest(value)`、`AGENT_DECISION_TOOL`。新类型先与 Phase 1 类型并存，保证每个任务结束时都能通过 TypeScript。

- [ ] **Step 1: 安装唯一新增开发依赖并增加命令**

Run:

```powershell
npm install --save-dev tsx
```

将 `package.json` 的 scripts 改为：

```json
{
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "lint": "eslint",
    "typecheck": "tsc --noEmit",
    "test": "tsx --test src/**/*.test.ts",
    "eval": "tsx eval/run-eval.ts"
  }
}
```

Expected: `package-lock.json` 只增加 `tsx` 及其必要传递依赖。

- [ ] **Step 2: 先写 Schema 失败测试**

Create `src/lib/agent-decision-schema.test.ts`:

```ts
import assert from "node:assert/strict";
import test from "node:test";

import {
  parseAgentDecision,
  parseAgentDecisionRequest,
} from "./agent-decision-schema";

const validDecision = {
  schemaVersion: "1.0",
  intent: "set_climate",
  confidence: 0.95,
  goal: "将座舱温度调到 24℃",
  plan: [
    {
      stepId: "step-1",
      description: "设置座舱温度",
      toolName: "setClimateTemperature",
    },
  ],
  memoryReferences: ["summer_climate_24"],
  proposedToolCalls: [
    {
      callId: "call-1",
      toolName: "setClimateTemperature",
      arguments: { temperature: 24 },
      expectedStateChange: { temperature: 24 },
    },
  ],
  clarificationNeeded: false,
  requiresConfirmation: false,
  responseDraft: "准备设置空调。",
};

test("接受合法 AgentDecision", () => {
  assert.equal(
    parseAgentDecision(validDecision, new Set(["summer_climate_24"]))
      .schemaVersion,
    "1.0",
  );
});

test("拒绝未知 Tool", () => {
  const invalid = structuredClone(validDecision);
  invalid.proposedToolCalls[0].toolName = "openDoor";
  assert.throws(() => parseAgentDecision(invalid, new Set()), /未知 Tool/);
});

test("拒绝未提供给 Agnes 的 Memory 引用", () => {
  assert.throws(
    () => parseAgentDecision(validDecision, new Set()),
    /Memory 引用不在允许列表/,
  );
});

test("拒绝越界温度", () => {
  const invalid = structuredClone(validDecision);
  invalid.proposedToolCalls[0].arguments = { temperature: 99 };
  assert.throws(() => parseAgentDecision(invalid, new Set(["summer_climate_24"])), /temperature/);
});

test("校验客户端 Decision Request", () => {
  assert.throws(() => parseAgentDecisionRequest({ userInput: "" }), /userInput/);
});
```

- [ ] **Step 3: 运行测试并确认失败原因正确**

Run:

```powershell
npm test -- --test-name-pattern="AgentDecision|未知 Tool|Memory|温度|Decision Request"
```

Expected: FAIL，提示 `parseAgentDecision` 或新类型尚不存在。

- [ ] **Step 4: 在独立文件定义结构化领域接口**

Create `src/domain/structured-agent.ts`，复用 `src/domain/agent.ts` 中稳定的 `VehicleContext`、`Memory`、`ToolName`、`ToolStatus` 和 `DecisionRisk`，不修改旧 `AgentDecision`：

```ts
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
```

- [ ] **Step 5: 实现严格解析和 Agnes Tool Schema**

在 `src/lib/agent-decision-schema.ts` 中实现并导出：

```ts
export const AGENT_DECISION_TOOL = {
  type: "function",
  function: {
    name: "submit_agent_decision",
    description: "提交结构化 Agent 决策；此函数不会直接执行车辆工具。",
    parameters: {
      type: "object",
      additionalProperties: false,
      required: [
        "schemaVersion",
        "intent",
        "confidence",
        "goal",
        "plan",
        "memoryReferences",
        "proposedToolCalls",
        "clarificationNeeded",
        "requiresConfirmation",
        "responseDraft",
      ],
      properties: {
        schemaVersion: { type: "string", enum: ["1.0"] },
        intent: { type: "string", minLength: 1, maxLength: 80 },
        confidence: { type: "number", minimum: 0, maximum: 1 },
        goal: { type: "string", minLength: 1, maxLength: 240 },
        plan: {
          type: "array",
          minItems: 0,
          maxItems: 8,
          items: {
            type: "object",
            additionalProperties: false,
            required: ["stepId", "description"],
            properties: {
              stepId: { type: "string", minLength: 1, maxLength: 40 },
              description: { type: "string", minLength: 1, maxLength: 160 },
              toolName: {
                type: "string",
                enum: [
                  "getVehicleState",
                  "setClimateTemperature",
                  "setNavigation",
                  "searchEnergyStation",
                  "searchRestaurant",
                ],
              },
            },
          },
        },
        memoryReferences: {
          type: "array",
          maxItems: 5,
          items: { type: "string", minLength: 1, maxLength: 80 },
        },
        proposedToolCalls: {
          type: "array",
          maxItems: 5,
          items: {
            type: "object",
            additionalProperties: false,
            required: ["callId", "toolName", "arguments"],
            properties: {
              callId: { type: "string", minLength: 1, maxLength: 40 },
              toolName: {
                type: "string",
                enum: [
                  "getVehicleState",
                  "setClimateTemperature",
                  "setNavigation",
                  "searchEnergyStation",
                  "searchRestaurant",
                ],
              },
              arguments: { type: "object" },
              expectedStateChange: { type: "object" },
            },
          },
        },
        clarificationNeeded: { type: "boolean" },
        requiresConfirmation: { type: "boolean" },
        confirmationPrompt: { type: "string", maxLength: 300 },
        responseDraft: { type: "string", minLength: 1, maxLength: 500 },
      },
    },
  },
} as const;
```

解析器必须使用直白的守卫函数检查对象、字符串长度、数组上限和每个 Tool 参数：`setClimateTemperature.temperature` 为 `-20..60`，`setNavigation.destination` 为 `1..120` 字符，读取/查询 Tool 不允许未知参数。`parseAgentDecisionRequest` 要求输入不超过 500 字、`batteryLevel` 为 `0..100`、Memory 最多 20 条。

- [ ] **Step 6: 运行 Schema 测试、类型检查并提交**

Run:

```powershell
npm test
npm run typecheck
git add package.json package-lock.json src/domain/structured-agent.ts src/lib/agent-decision-schema.ts src/lib/agent-decision-schema.test.ts
git diff --cached --check
git commit -m "feat: enforce structured agent decisions"
```

Expected: 测试全部 PASS，TypeScript 无错误，提交成功。

---

### Task 3: 接入 Agnes 服务端 Structured Decision

**Files:**
- Create: `src/lib/agnes-client.ts`
- Create: `src/lib/agnes-client.test.ts`
- Create: `src/app/api/agent/decision/route.ts`
- Create: `.env.example`
- Modify: `.gitignore`

**Interfaces:**
- Consumes: `AgentDecisionRequest`、`parseAgentDecision`、`AGENT_DECISION_TOOL`。
- Produces: `requestAgnesDecision(request, options?) -> Promise<StructuredAgentDecision>`、`AgnesClientError`、`POST /api/agent/decision`。

- [ ] **Step 1: 写 Agnes Client 失败测试**

Create `src/lib/agnes-client.test.ts`，使用注入的 `fetchFn`，不得发真实网络请求：

```ts
import assert from "node:assert/strict";
import test from "node:test";

import { AgnesClientError, requestAgnesDecision } from "./agnes-client";
import { initialVehicleContext, mockMemories } from "../data/mock-data";

const request = {
  userInput: "今晚还是老样子吧",
  context: initialVehicleContext,
  memories: mockMemories,
};

test("缺少 Agnes Key 时不发送请求", async () => {
  await assert.rejects(
    requestAgnesDecision(request, { apiKey: "", fetchFn: fetch }),
    (error: unknown) =>
      error instanceof AgnesClientError && error.code === "NOT_CONFIGURED",
  );
});

test("解析 submit_agent_decision 参数", async () => {
  const fetchFn: typeof fetch = async () =>
    new Response(JSON.stringify({
      choices: [{
        message: {
          tool_calls: [{
            function: {
              name: "submit_agent_decision",
              arguments: JSON.stringify({
                schemaVersion: "1.0",
                intent: "clarify",
                confidence: 0.7,
                goal: "确认用户意图",
                plan: [],
                memoryReferences: [],
                proposedToolCalls: [],
                clarificationNeeded: true,
                requiresConfirmation: false,
                responseDraft: "请说明具体安排。",
              }),
            },
          }],
        },
      }],
    }), { status: 200 });

  const decision = await requestAgnesDecision(request, {
    apiKey: "test-key",
    fetchFn,
  });
  assert.equal(decision.intent, "clarify");
});

test("上游没有强制函数调用时拒绝结果", async () => {
  const fetchFn: typeof fetch = async () =>
    new Response(JSON.stringify({ choices: [{ message: { content: "ok" } }] }), {
      status: 200,
    });
  await assert.rejects(
    requestAgnesDecision(request, { apiKey: "test-key", fetchFn }),
    /submit_agent_decision/,
  );
});
```

- [ ] **Step 2: 运行 Agnes 测试并确认失败**

Run:

```powershell
npm test -- --test-name-pattern="Agnes|submit_agent_decision"
```

Expected: FAIL，提示 `agnes-client` 模块不存在。

- [ ] **Step 3: 实现 Agnes Client**

`src/lib/agnes-client.ts` 的公开接口固定为：

```ts
interface AgnesClientOptions {
  apiKey?: string;
  fetchFn?: typeof fetch;
  timeoutMs?: number;
}

export type AgnesErrorCode =
  | "NOT_CONFIGURED"
  | "TIMEOUT"
  | "UPSTREAM_ERROR"
  | "INVALID_RESPONSE";

export class AgnesClientError extends Error {
  constructor(
    public readonly code: AgnesErrorCode,
    message: string,
    public readonly status?: number,
  ) {
    super(message);
    this.name = "AgnesClientError";
  }
}

export async function requestAgnesDecision(
  request: AgentDecisionRequest,
  options: AgnesClientOptions = {},
): Promise<StructuredAgentDecision>;
```

实现要求：

```ts
const response = await fetchFn(
  "https://apihub.agnes-ai.com/v1/chat/completions",
  {
    method: "POST",
    signal: controller.signal,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: "agnes-2.5-flash",
      temperature: 0.1,
      messages: [systemMessage, userMessage],
      tools: [AGENT_DECISION_TOOL],
      tool_choice: {
        type: "function",
        function: { name: "submit_agent_decision" },
      },
    }),
  },
);
```

使用 `AbortController` 在默认 20,000ms 后取消；`finally` 中 `clearTimeout`。解析时只接受 `submit_agent_decision` 的 `arguments`，随后用请求中 Memory ID 集合调用 `parseAgentDecision`。不得记录 Authorization 或上游完整响应。

- [ ] **Step 4: 实现 Route Handler 和安全错误映射**

Create `src/app/api/agent/decision/route.ts`:

```ts
import { NextResponse } from "next/server";

import { AgnesClientError, requestAgnesDecision } from "@/lib/agnes-client";
import { parseAgentDecisionRequest } from "@/lib/agent-decision-schema";

export async function POST(request: Request) {
  try {
    const body: unknown = await request.json();
    const decisionRequest = parseAgentDecisionRequest(body);
    const decision = await requestAgnesDecision(decisionRequest);
    return NextResponse.json({ decision });
  } catch (error) {
    if (error instanceof SyntaxError) {
      return NextResponse.json({ error: "请求 JSON 无效。" }, { status: 400 });
    }
    if (error instanceof AgnesClientError) {
      const status =
        error.code === "NOT_CONFIGURED" ? 503 :
        error.code === "TIMEOUT" ? 504 : 502;
      return NextResponse.json({ error: error.message }, { status });
    }
    const message = error instanceof Error ? error.message : "请求参数无效。";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
```

- [ ] **Step 5: 增加环境变量模板并验证不会提交 Key**

Create `.env.example`:

```dotenv
AGNES_API_KEY=
```

在 `.gitignore` 的 `.env*` 后增加：

```gitignore
!.env.example
```

Run:

```powershell
git check-ignore .env.local
git check-ignore .env.example
```

Expected: `.env.local` 被忽略；`.env.example` 不被忽略，第二条命令返回非零且不输出路径。

- [ ] **Step 6: 测试并提交 Agnes 接入**

Run:

```powershell
npm test
npm run typecheck
git add .env.example .gitignore src/lib/agnes-client.ts src/lib/agnes-client.test.ts src/app/api/agent/decision/route.ts
git diff --cached --check
git commit -m "feat: connect Agnes structured decisions"
```

Expected: 测试与类型检查通过；提交中不包含 `.env.local`。

---

### Task 4: 强化 Permission、Tool Result、Verification 和真实结果回复

**Files:**
- Modify: `src/lib/permission-engine.ts:1-66`
- Modify: `src/lib/mock-tools.ts:1-73`
- Modify: `src/lib/state-verification.ts:1-29`
- Create: `src/lib/response-composer.ts`
- Create: `src/lib/execution-pipeline.ts`
- Create: `src/lib/execution-pipeline.test.ts`

**Interfaces:**
- Consumes: `ProposedToolCall`、`Memory[]`、`VehicleContext`、`ToolStatus`。
- Produces: `evaluateStructuredPermission(input)`、`runStructuredMockTool(call, status, context)`、`verifyStructuredToolResult(call, result)`、`prepareAgentRun(input)`、`completeAgentRun(run, statuses)`。旧 Phase 1 导出保持不变，避免中间提交破坏现有演示。

- [ ] **Step 1: 写程序权限覆盖和失败语义测试**

Create `src/lib/execution-pipeline.test.ts`，先写完整测试夹具和以下断言：

```ts
import assert from "node:assert/strict";
import test from "node:test";

import { initialToolStatuses, initialVehicleContext, mockMemories } from "../data/mock-data";
import type {
  ProposedToolCall,
  StructuredAgentDecision,
} from "../domain/structured-agent";
import { completeAgentRun, prepareAgentRun } from "./execution-pipeline";
import { verifyStructuredToolResult } from "./state-verification";

const navigationCall: ProposedToolCall = {
  callId: "call-navigation",
  toolName: "setNavigation",
  arguments: { destination: "Home" },
  expectedStateChange: { destination: "Home" },
};

const climateCall: ProposedToolCall = {
  callId: "call-climate",
  toolName: "setClimateTemperature",
  arguments: { temperature: 24 },
  expectedStateChange: { temperature: 24 },
};

function createDecision(
  calls: ProposedToolCall[],
  memoryReferences: string[] = [],
): StructuredAgentDecision {
  return {
    schemaVersion: "1.0",
    intent: "execute_trip",
    confidence: 0.95,
    goal: "执行经过验证的出行操作",
    plan: calls.map((call, index) => ({
      stepId: `step-${index + 1}`,
      description: `执行 ${call.toolName}`,
      toolName: call.toolName,
    })),
    memoryReferences,
    proposedToolCalls: calls,
    clarificationNeeded: false,
    requiresConfirmation: calls.some(
      (call) => call.toolName === "setNavigation",
    ),
    confirmationPrompt: "是否确认执行导航方案？",
    responseDraft: "方案已经准备好。",
  };
}

const navigationDecision = createDecision([navigationCall]);
const climateDecisionWithoutMemory = createDecision([climateCall]);
const partialSuccessInput = {
  decision: createDecision(
    [navigationCall, climateCall],
    ["summer_climate_24"],
  ),
  decisionSource: "mock" as const,
  context: initialVehicleContext,
  memories: mockMemories,
  statuses: initialToolStatuses,
};

test("LLM 要求直接导航时程序仍要求确认", () => {
  const run = prepareAgentRun({
    decision: navigationDecision,
    decisionSource: "mock",
    context: initialVehicleContext,
    memories: mockMemories,
    statuses: initialToolStatuses,
  });
  assert.equal(run.phase, "awaiting_confirmation");
  assert.equal(run.executions[0].permission.outcome, "REQUIRE_CONFIRMATION");
  assert.equal(run.executions[0].result, undefined);
});

test("未授权空调动作被拒绝，即使 LLM 标记无需确认", () => {
  const run = prepareAgentRun({
    decision: climateDecisionWithoutMemory,
    decisionSource: "mock",
    context: initialVehicleContext,
    memories: [],
    statuses: initialToolStatuses,
  });
  assert.equal(run.executions[0].permission.outcome, "DENY");
  assert.equal(run.executions[0].result, undefined);
});

test("导航成功且空调 FAILED 时返回部分成功", () => {
  const prepared = prepareAgentRun(partialSuccessInput);
  const completed = completeAgentRun(prepared, {
    ...initialToolStatuses,
    setNavigation: "SUCCESS",
    setClimateTemperature: "FAILED",
  });
  assert.match(completed.response, /导航.*成功|导航.*设置/);
  assert.match(completed.response, /空调.*失败/);
  assert.equal(completed.casePassed, false);
});

test("TIMEOUT 只能表述为结果未知", () => {
  const completed = completeAgentRun(prepareAgentRun(partialSuccessInput), {
    ...initialToolStatuses,
    setClimateTemperature: "TIMEOUT",
  });
  assert.match(completed.response, /未知|没有返回确认/);
  assert.doesNotMatch(completed.response, /空调.*成功/);
});

test("SUCCESS 但观测状态不匹配时禁止声称成功", () => {
  const record = verifyStructuredToolResult(
    climateCall,
    {
      callId: climateCall.callId,
      tool: climateCall.toolName,
      status: "SUCCESS",
      message: "Mock 返回成功。",
      data: { temperature: 26 },
    },
  );
  assert.equal(record.canClaimSuccess, false);
});
```

- [ ] **Step 2: 运行测试并确认失败**

Run:

```powershell
npm test -- --test-name-pattern="LLM|未授权|部分成功|TIMEOUT|观测状态"
```

Expected: FAIL，提示新 Pipeline 或新接口尚不存在。

- [ ] **Step 3: 实现程序唯一风险映射**

`src/lib/permission-engine.ts` 中保留以下固定映射：

```ts
const toolRiskMap: Record<ToolName, DecisionRisk> = {
  getVehicleState: "read",
  searchEnergyStation: "read",
  searchRestaurant: "read",
  setClimateTemperature: "low",
  setNavigation: "high",
};
```

保留旧 `evaluatePermission`，新增结构化接口：

```ts
interface PermissionInput {
  call: ProposedToolCall;
  userAuthorized: boolean;
  reversible: boolean;
  userConfirmed: boolean;
}

export function evaluateStructuredPermission(
  input: PermissionInput,
): PermissionEvaluation;
```

读取操作返回 `ALLOW`；低风险满足授权且可撤销才返回 `ALLOW`，否则 `DENY`；高风险在确认前返回 `REQUIRE_CONFIRMATION`，确认后返回 `ALLOW`。`risk` 只能来自 `toolRiskMap`。

- [ ] **Step 4: 让 Mock Tool 和 Verification 绑定 callId**

保留旧 `runMockTool`，新增结构化接口：

```ts
export function runStructuredMockTool(
  call: ProposedToolCall,
  status: ToolStatus,
  context: VehicleContext,
): ExecutionToolResult;
```

Tool 参数只能从已校验 `call.arguments` 中读取，所有返回都包含 `callId`。成功写操作必须返回可验证数据：空调 `{ temperature }`，导航 `{ destination }`。

保留旧 `verifyToolResult`，新增结构化验证接口：

```ts
export function verifyStructuredToolResult(
  call: ProposedToolCall,
  result: ExecutionToolResult,
): StructuredVerificationRecord;
```

如果状态不是 `SUCCESS`，`canClaimSuccess=false`；如果存在 `expectedStateChange`，逐键对比 `result.data`，任意不一致都返回 `verified=false`、`canClaimSuccess=false`。

- [ ] **Step 5: 实现统一执行 Pipeline 和程序回复**

`src/lib/execution-pipeline.ts` 公开接口固定为：

```ts
interface PrepareAgentRunInput {
  decision: StructuredAgentDecision;
  decisionSource: "agnes" | "mock";
  context: VehicleContext;
  memories: Memory[];
  statuses: Record<ToolName, ToolStatus>;
}

export function prepareAgentRun(input: PrepareAgentRunInput): AgentExecutionRun;

export function completeAgentRun(
  run: AgentExecutionRun,
  statuses: Record<ToolName, ToolStatus>,
): AgentExecutionRun;
```

空调授权只在 `decision.memoryReferences` 引用了 `status=active` 且 `userConfirmed=true` 的温度偏好时为真；空调操作固定可撤销；导航确认只在 `completeAgentRun` 中设为真。`prepareAgentRun` 立即执行读取类 `ALLOW` 调用；如果批次中存在 `REQUIRE_CONFIRMATION`，则把所有写调用一起放入 `pendingToolCalls`，保证确认后一次执行并能准确演示部分成功；`DENY` 永远不执行。

`src/lib/response-composer.ts` 必须逐项组合以下事实：

```ts
export function composeExecutionResponse(
  executions: ToolExecutionRecord[],
): {
  response: string;
  falseSuccessPrevented: boolean;
  casePassed: boolean;
};
```

- `ALLOW + verified`：写入“已完成”。
- `FAILED`：写入“执行失败”。
- `TIMEOUT`：写入“结果未知，未收到确认”。
- `SUCCESS + verification false`：写入“返回成功但状态验证不一致”。
- `DENY`：写入“已被权限规则阻止”。
- 多种结果并存：逐项说明，`casePassed=false`。

- [ ] **Step 6: 运行测试并提交安全执行层**

Run:

```powershell
npm test
npm run typecheck
git add src/lib/permission-engine.ts src/lib/mock-tools.ts src/lib/state-verification.ts src/lib/response-composer.ts src/lib/execution-pipeline.ts src/lib/execution-pipeline.test.ts
git diff --cached --check
git commit -m "feat: enforce permission and verified tool outcomes"
```

Expected: 权限、失败、超时、部分成功、状态不一致测试全部 PASS。

---

### Task 5: 实现 Memory Candidate、Active、Pause 和 Forget

**Files:**
- Create: `src/lib/memory-engine.ts`
- Create: `src/lib/memory-engine.test.ts`
- Modify: `src/domain/agent.ts:18-42`
- Modify: `src/data/mock-data.ts:1-78`

**Interfaces:**
- Consumes: `Memory[]` 和用户输入。
- Produces: `observeMemoryFromInput`、`confirmMemory`、`pauseMemory`、`resumeMemory`、`forgetMemory`、`selectActiveMemories`。

- [ ] **Step 1: 写完整 Memory 生命周期失败测试**

Create `src/lib/memory-engine.test.ts`:

```ts
import assert from "node:assert/strict";
import test from "node:test";

import type { Memory } from "../domain/agent";

import {
  confirmMemory,
  forgetMemory,
  observeMemoryFromInput,
  pauseMemory,
  resumeMemory,
  selectActiveMemories,
} from "./memory-engine";

const candidateMemory: Memory = {
  id: "climate_24_candidate",
  type: "temporary",
  content: "偏好将空调设置为 24℃",
  context: { temperature: 24 },
  confidence: 0.9,
  sensitivity: "low",
  source: "repeated_behavior",
  status: "candidate",
  userConfirmed: false,
  observationCount: 3,
};

const candidateMemories = [candidateMemory];
const activeMemories: Memory[] = [
  {
    ...candidateMemory,
    type: "preference",
    status: "active",
    userConfirmed: true,
  },
];

test("第三次相同空调偏好形成 Candidate", () => {
  let memories: Memory[] = [];
  memories = observeMemoryFromInput(memories, "空调24℃就行");
  memories = observeMemoryFromInput(memories, "空调 24 度就行");
  memories = observeMemoryFromInput(memories, "空调24℃就行。");
  assert.equal(memories[0].observationCount, 3);
  assert.equal(memories[0].status, "candidate");
  assert.equal(memories[0].userConfirmed, false);
});

test("Candidate 只有确认后才能成为 Active", () => {
  const active = confirmMemory(candidateMemories, "climate_24_candidate");
  assert.equal(active[0].status, "active");
  assert.equal(active[0].userConfirmed, true);
  assert.equal(selectActiveMemories(active).length, 1);
});

test("Pause 后不参与决策，Resume 后恢复", () => {
  const paused = pauseMemory(activeMemories, "climate_24_candidate");
  assert.equal(selectActiveMemories(paused).length, 0);
  const resumed = resumeMemory(paused, "climate_24_candidate");
  assert.equal(selectActiveMemories(resumed).length, 1);
});

test("Forget 后不参与决策", () => {
  const forgotten = forgetMemory(activeMemories, "climate_24_candidate");
  assert.equal(forgotten[0].status, "deleted");
  assert.equal(selectActiveMemories(forgotten).length, 0);
});
```

- [ ] **Step 2: 运行测试并确认失败**

Run:

```powershell
npm test -- --test-name-pattern="Candidate|Pause|Forget"
```

Expected: FAIL，提示 `memory-engine` 不存在。

- [ ] **Step 3: 实现最小 Memory Engine**

`src/lib/memory-engine.ts` 固定识别本轮演示偏好“空调 24℃”，不增加通用 NLP：

```ts
const CLIMATE_MEMORY_ID = "climate_24_candidate";

function isClimate24Preference(input: string): boolean {
  const normalized = input.replace(/[\s。！？!?]/g, "");
  return /空调(?:调到)?24(?:℃|度)?就行/.test(normalized);
}

export function observeMemoryFromInput(
  memories: Memory[],
  input: string,
): Memory[];

export function confirmMemory(memories: Memory[], id: string): Memory[];
export function pauseMemory(memories: Memory[], id: string): Memory[];
export function resumeMemory(memories: Memory[], id: string): Memory[];
export function forgetMemory(memories: Memory[], id: string): Memory[];
export function selectActiveMemories(memories: Memory[]): Memory[];
```

第一次和第二次观察状态为 `temporary`；第三次及以后为 `candidate`。只有 Candidate 可确认；只有 Active 可 Pause；只有 Suspended 可 Resume；Forget 把非 Deleted 状态改为 Deleted。无效 ID 或非法状态转换返回原数组，不抛出导致界面崩溃的异常。

- [ ] **Step 4: 扩展 Memory 状态并补齐 Mock 数据**

在 `src/domain/agent.ts` 将状态扩展为：

```ts
export type MemoryStatus =
  | "temporary"
  | "candidate"
  | "active"
  | "suspended"
  | "deleted";
```

并在 `Memory` 中增加必填字段：

```ts
observationCount: number;
```

在 `src/data/mock-data.ts` 给每条已存在 Active Memory 增加：

```ts
observationCount: 3,
```

增加安全工厂，防止 Reset 复用被修改的对象：

```ts
export function createMockMemories(): Memory[] {
  return mockMemories.map((memory) => ({
    ...memory,
    context: memory.context ? { ...memory.context } : undefined,
  }));
}
```

- [ ] **Step 5: 运行测试并提交 Memory Engine**

Run:

```powershell
npm test
npm run typecheck
git add src/domain/agent.ts src/lib/memory-engine.ts src/lib/memory-engine.test.ts src/data/mock-data.ts
git diff --cached --check
git commit -m "feat: add controllable memory lifecycle"
```

Expected: 生命周期测试和全量测试通过。

---

### Task 6: 建立复用统一 Pipeline 的 Scenario 01/02/03 Mock 模式

**Files:**
- Create: `src/lib/mock-agent-decision.ts`
- Modify: `src/lib/execution-pipeline.test.ts`

**Interfaces:**
- Consumes: 用户输入、Context、Active Memory。
- Produces: `createMockAgentDecision(input, context, memories) -> StructuredAgentDecision`。旧 `scenario-01.ts` 保留为 Phase 1 基线，新的 UI 直接复用统一 Pipeline。

- [ ] **Step 1: 写 Scenario 01 和 Scenario 03 决策测试**

追加到 `src/lib/execution-pipeline.test.ts`：

```ts
test("Scenario 01 生成导航确认和已授权空调调用", () => {
  const decision = createMockAgentDecision(
    "今晚还是老样子吧",
    initialVehicleContext,
    mockMemories,
  );
  assert.equal(decision.intent, "reuse_routine");
  assert.equal(decision.requiresConfirmation, true);
  assert.deepEqual(
    decision.proposedToolCalls.map((call) => call.toolName),
    [
      "getVehicleState",
      "searchEnergyStation",
      "searchRestaurant",
      "setNavigation",
      "setClimateTemperature",
    ],
  );
});

test("Scenario 03 生成回家导航和 24℃ 空调调用", () => {
  const decision = createMockAgentDecision(
    "回家，把空调调到24℃",
    initialVehicleContext,
    mockMemories,
  );
  assert.deepEqual(
    decision.proposedToolCalls.map((call) => call.toolName),
    ["setNavigation", "setClimateTemperature"],
  );
});
```

- [ ] **Step 2: 运行测试并确认失败**

Run:

```powershell
npm test -- --test-name-pattern="Scenario 01|Scenario 03"
```

Expected: FAIL，提示 `createMockAgentDecision` 不存在。

- [ ] **Step 3: 实现固定 Mock Decision Builder**

`src/lib/mock-agent-decision.ts` 只识别：

- `今晚还是老样子吧`：使用现有 Scenario 01 Memory 选择逻辑。
- `回家，把空调调到24℃`：提出回家导航和 24℃ 空调。
- `空调24℃就行`：提出 24℃ 空调；Candidate 尚未 Active 时该动作会被程序 Permission Engine 拒绝。
- `查看当前车辆状态`：只提出 `getVehicleState` 读取调用。
- 其他输入：`clarificationNeeded=true`、无 Tool Call。

每个 Tool Call 使用稳定 `callId`，写操作设置 `expectedStateChange`。Scenario 01 的 `setNavigation` 必须 `requiresConfirmation=true`；Context 不匹配时无 Tool Call 并要求澄清。

- [ ] **Step 4: 验证 Mock Decision 只引用有效 Active Memory**

`createMockAgentDecision` 在构造 Scenario 01 前调用现有 `selectScenario01Memories`，再额外过滤 `status=active && userConfirmed=true`，最多 5 条。Scenario 02 只有 Active 的 24℃ Memory 才能写入 `memoryReferences`；Candidate、Suspended、Deleted 均返回空引用。

- [ ] **Step 5: 运行回归测试并提交**

Run:

```powershell
npm test
npm run typecheck
npm run lint
git add src/lib/mock-agent-decision.ts src/lib/execution-pipeline.test.ts
git diff --cached --check
git commit -m "refactor: share the verified agent pipeline"
```

Expected: 旧 Scenario 01 和新增 Scenario 03 测试通过，lint 无错误。

---

### Task 7: 接入三栏 UI、Memory 控件和 Agnes/Mock 模式

**Files:**
- Modify: `src/components/agent/agent-demo.tsx:1-176`
- Modify: `src/components/agent/chat-panel.tsx:1-139`
- Modify: `src/components/agent/inspector-panel.tsx:1-81`
- Modify: `src/components/agent/inspector-sections.tsx:1-276`
- Modify: `src/components/agent/status-badge.tsx`

**Interfaces:**
- Consumes: `POST /api/agent/decision`、统一 Pipeline、Memory Engine。
- Produces: 可切换 Agnes/Mock 的完整三栏交互，Candidate Confirm、Pause、Resume、Forget 控件。

- [ ] **Step 1: 在 AgentDemo 建立真实决策请求函数**

在 `src/components/agent/agent-demo.tsx` 增加：

```ts
type DecisionMode = "agnes" | "mock";

async function fetchAgnesDecision(
  userInput: string,
  context: VehicleContext,
  memories: Memory[],
): Promise<StructuredAgentDecision> {
  const response = await fetch("/api/agent/decision", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ userInput, context, memories }),
  });
  const body: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    const message =
      body && typeof body === "object" && "error" in body &&
      typeof body.error === "string"
        ? body.error
        : "Agnes 决策请求失败。";
    throw new Error(message);
  }
  if (!body || typeof body !== "object" || !("decision" in body)) {
    throw new Error("Agnes 返回缺少 decision。" );
  }
  return parseAgentDecision(
    body.decision,
    new Set(memories.map((memory) => memory.id)),
  );
}
```

组件状态增加 `decisionMode`、`memories`、`lastSubmittedInput`。发送前调用 `observeMemoryFromInput`，只把 `selectActiveMemories` 传给 Agnes。Agnes 模式调用 API；Mock 模式调用 `createMockAgentDecision`；两者随后都调用 `prepareAgentRun`。

- [ ] **Step 2: 保证错误和重试不会重复执行 Tool**

请求失败时：

- `setRun(null)`；
- 不调用 `prepareAgentRun`；
- 在 `inputError` 显示错误；
- 保留 `lastSubmittedInput`；
- 重试只重新获取 Decision，成功验证后才进入 Pipeline。

确认按钮只在 `run.phase === "awaiting_confirmation"` 时调用 `completeAgentRun`。Reset 恢复 Context、Tool 状态、Memory、消息和输入，不触发 Agnes。

- [ ] **Step 3: 给 ChatPanel 增加明确模式和请求状态**

`ChatPanelProps` 增加：

```ts
decisionMode: "agnes" | "mock";
onDecisionModeChange: (mode: "agnes" | "mock") => void;
onRetry: () => void;
canRetry: boolean;
```

页头用 `<select>` 提供 `Agnes AI` 和 `Phase 1 Mock` 两项。Agnes 模式描述为“真实 Agnes · Structured Decision”；Mock 模式描述为“本地固定 Decision”。Processing 文案改为“正在生成并校验 Agent Decision…”。错误区在 `canRetry=true` 时显示“重新尝试”按钮。

- [ ] **Step 4: 给 Inspector 增加 Memory 生命周期控件**

`InspectorPanelProps` 增加：

```ts
memories: Memory[];
onConfirmMemory: (id: string) => void;
onPauseMemory: (id: string) => void;
onResumeMemory: (id: string) => void;
onForgetMemory: (id: string) => void;
```

`MemoryInspector` 默认隐藏 `deleted`，每条 Memory 显示状态和 `observationCount`：Candidate 显示“确认”；Active 显示“暂停”和“忘记”；Suspended 显示“恢复”和“忘记”。按钮 disabled 状态继承 processing。

`PlanInspector` 改为显示 `step.description` 和 `step.toolName`。`SafetyInspector` 显示 `permission.outcome`，并按 `callId` 展示 Tool Result 与 Verification，避免同一 Tool 多次调用时 key 冲突。

- [ ] **Step 5: 运行静态检查和构建**

Run:

```powershell
npm test
npm run typecheck
npm run lint
npm run build
```

Expected: 四条命令均退出码 `0`；`/agent` 页面参与 production build。

- [ ] **Step 6: 浏览器验证三个场景**

Run:

```powershell
npm run dev
```

在 `http://localhost:3000/agent` 验证：

1. Mock 模式 Scenario 01：发送“今晚还是老样子吧”后先等待确认；确认后完成 Tool 和 Verification。
2. 连续发送三次“空调24℃就行”：第三次出现 Candidate；确认后 Active；Pause 后不再传入决策；Resume 后恢复；Forget 后消失且不再使用。
3. Scenario 03：将导航设 `SUCCESS`、空调分别设 `FAILED` 和 `TIMEOUT`，最终回复分别显示部分成功和结果未知。
4. Agnes 模式未配置 Key：显示配置错误且没有 Tool Result。
5. Agnes 模式配置 Key：Inspector 显示 `decisionSource=agnes` 和 Structured Decision，导航仍需程序确认。

- [ ] **Step 7: 提交 UI 闭环**

Run:

```powershell
git add src/components/agent/agent-demo.tsx src/components/agent/chat-panel.tsx src/components/agent/inspector-panel.tsx src/components/agent/inspector-sections.tsx src/components/agent/status-badge.tsx
git diff --cached --check
git commit -m "feat: demo Agnes decisions and memory controls"
```

Expected: 提交成功，未包含 `.env.local`。

---

### Task 8: 增加 15 条固定 Eval Case 和简单结果

**Files:**
- Create: `eval/cases.ts`
- Create: `eval/run-eval.ts`
- Create: `eval/results/latest.json`
- Modify: `src/lib/execution-pipeline.test.ts`

**Interfaces:**
- Consumes: Mock Decision、统一 Pipeline、Permission、Tool、Verification、Memory Engine。
- Produces: `evalCases`（恰好 15 条）、`npm run eval`、六项指标 JSON。

- [ ] **Step 1: 定义 Case 类型和 15 个稳定用例**

`eval/cases.ts` 导出：

```ts
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
  category:
    | "normal"
    | "ambiguous"
    | "memory"
    | "tool"
    | "permission"
    | "verification";
  input: string;
  context: VehicleContext;
  memories: Memory[];
  statuses: Record<ToolName, ToolStatus>;
  confirm: boolean;
  decision?: StructuredAgentDecision;
  expected: EvalExpectation;
}
```

使用以下完整工厂和 Case 声明；`createEvalCase` 必须深拷贝 Context、Memory 和 Tool 状态，防止 Case 相互污染：

```ts
function createEvalCase(
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
    decision: overrides.decision,
    expected: overrides.expected,
  };
}

function expectation(
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

function memoryInStatus(status: Memory["status"], userConfirmed: boolean): Memory[] {
  return createMockMemories().map((memory) =>
    memory.id === "summer_climate_24"
      ? { ...memory, status, userConfirmed }
      : memory,
  );
}

const climateMismatchDecision = createMockAgentDecision(
  "空调24℃就行",
  initialVehicleContext,
  createMockMemories(),
);
climateMismatchDecision.proposedToolCalls[0].expectedStateChange = {
  temperature: 26,
};

const navigationMismatchDecision = createMockAgentDecision(
  "回家，把空调调到24℃",
  initialVehicleContext,
  createMockMemories(),
);
navigationMismatchDecision.proposedToolCalls.find(
  (call) => call.toolName === "setNavigation",
)!.expectedStateChange = { destination: "Office" };

export const evalCases: EvalCase[] = [
  createEvalCase({
    id: "normal-01-routine",
    category: "normal",
    input: "今晚还是老样子吧",
    confirm: true,
    expected: expectation({
      intent: "reuse_routine",
      memoryIds: [
        "friday_gym",
        "friday_restaurant",
        "low_battery_energy",
        "summer_climate_24",
      ],
      executedTools: [
        "getVehicleState",
        "searchEnergyStation",
        "searchRestaurant",
        "setNavigation",
        "setClimateTemperature",
      ],
      responseIncludes: ["已完成"],
    }),
  }),
  createEvalCase({
    id: "normal-02-read-state",
    category: "normal",
    input: "查看当前车辆状态",
    expected: expectation({
      intent: "read_vehicle_state",
      executedTools: ["getVehicleState"],
    }),
  }),
  createEvalCase({
    id: "normal-03-active-climate",
    category: "normal",
    input: "空调24℃就行",
    expected: expectation({
      intent: "set_climate",
      memoryIds: ["summer_climate_24"],
      executedTools: ["setClimateTemperature"],
    }),
  }),
  createEvalCase({
    id: "ambiguous-01-context-mismatch",
    category: "ambiguous",
    input: "今晚还是老样子吧",
    context: { ...initialVehicleContext, currentTime: "Monday 10:00" },
    expected: expectation({ intent: "clarify_routine" }),
  }),
  createEvalCase({
    id: "ambiguous-02-unknown-command",
    category: "ambiguous",
    input: "处理一下",
    expected: expectation({ intent: "clarify" }),
  }),
  createEvalCase({
    id: "memory-01-candidate-excluded",
    category: "memory",
    input: "空调24℃就行",
    memories: memoryInStatus("candidate", false),
    expected: expectation({
      intent: "set_climate",
      deniedTools: ["setClimateTemperature"],
      casePassed: false,
    }),
  }),
  createEvalCase({
    id: "memory-02-active-included",
    category: "memory",
    input: "空调24℃就行",
    memories: memoryInStatus("active", true),
    expected: expectation({
      intent: "set_climate",
      memoryIds: ["summer_climate_24"],
      executedTools: ["setClimateTemperature"],
    }),
  }),
  createEvalCase({
    id: "memory-03-suspended-excluded",
    category: "memory",
    input: "空调24℃就行",
    memories: memoryInStatus("suspended", true),
    expected: expectation({
      intent: "set_climate",
      deniedTools: ["setClimateTemperature"],
      casePassed: false,
    }),
  }),
  createEvalCase({
    id: "tool-01-climate-failed-partial",
    category: "tool",
    input: "回家，把空调调到24℃",
    confirm: true,
    statuses: { ...initialToolStatuses, setClimateTemperature: "FAILED" },
    expected: expectation({
      intent: "navigate_home_and_set_climate",
      memoryIds: ["summer_climate_24"],
      executedTools: ["setNavigation", "setClimateTemperature"],
      responseIncludes: ["导航", "空调", "失败"],
      casePassed: false,
    }),
  }),
  createEvalCase({
    id: "tool-02-climate-timeout-partial",
    category: "tool",
    input: "回家，把空调调到24℃",
    confirm: true,
    statuses: { ...initialToolStatuses, setClimateTemperature: "TIMEOUT" },
    expected: expectation({
      intent: "navigate_home_and_set_climate",
      memoryIds: ["summer_climate_24"],
      executedTools: ["setNavigation", "setClimateTemperature"],
      responseIncludes: ["导航", "未知"],
      casePassed: false,
    }),
  }),
  createEvalCase({
    id: "tool-03-navigation-failed",
    category: "tool",
    input: "回家，把空调调到24℃",
    confirm: true,
    statuses: { ...initialToolStatuses, setNavigation: "FAILED" },
    expected: expectation({
      intent: "navigate_home_and_set_climate",
      memoryIds: ["summer_climate_24"],
      executedTools: ["setNavigation", "setClimateTemperature"],
      responseIncludes: ["导航", "失败"],
      casePassed: false,
    }),
  }),
  createEvalCase({
    id: "permission-01-navigation-waits",
    category: "permission",
    input: "回家，把空调调到24℃",
    expected: expectation({
      intent: "navigate_home_and_set_climate",
      memoryIds: ["summer_climate_24"],
      phase: "awaiting_confirmation",
      casePassed: false,
    }),
  }),
  createEvalCase({
    id: "permission-02-climate-denied",
    category: "permission",
    input: "空调24℃就行",
    memories: [],
    expected: expectation({
      intent: "set_climate",
      deniedTools: ["setClimateTemperature"],
      casePassed: false,
    }),
  }),
  createEvalCase({
    id: "verification-01-climate-mismatch",
    category: "verification",
    input: "空调24℃就行",
    decision: climateMismatchDecision,
    expected: expectation({
      intent: "set_climate",
      memoryIds: ["summer_climate_24"],
      executedTools: ["setClimateTemperature"],
      responseIncludes: ["验证不一致"],
      casePassed: false,
    }),
  }),
  createEvalCase({
    id: "verification-02-navigation-mismatch",
    category: "verification",
    input: "回家，把空调调到24℃",
    confirm: true,
    decision: navigationMismatchDecision,
    expected: expectation({
      intent: "navigate_home_and_set_climate",
      memoryIds: ["summer_climate_24"],
      executedTools: ["setNavigation", "setClimateTemperature"],
      responseIncludes: ["导航", "验证不一致"],
      casePassed: false,
    }),
  }),
];
```

Runner 使用 `decision ?? createMockAgentDecision(input, context, memories)`，不得依赖真实 Agnes。

- [ ] **Step 2: 写 Eval 数量和关键安全断言测试**

追加到 `src/lib/execution-pipeline.test.ts`：

```ts
test("Eval 固定为 15 条且 ID 唯一", () => {
  assert.equal(evalCases.length, 15);
  assert.equal(new Set(evalCases.map((item) => item.id)).size, 15);
});

test("Permission Case 没有未授权 Tool Result", () => {
  const permissionCases = evalCases.filter(
    (item) => item.category === "permission",
  );
  for (const item of permissionCases) {
    const result = runEvalCase(item);
    assert.equal(result.unauthorizedActionCount, 0, item.id);
  }
});
```

- [ ] **Step 3: 实现确定性 Runner 和指标**

`eval/run-eval.ts` 必须导出 `runEvalCase` 和 `runAllEvalCases`，再在直接执行时将 JSON 写入 `eval/results/latest.json`。指标定义固定为：

```ts
interface EvalMetrics {
  totalCases: number;
  passedCases: number;
  intentAccuracy: number;
  memoryAccuracy: number;
  taskCompletionRate: number;
  toolSuccessRate: number;
  falseSuccessRate: number;
  unauthorizedActionCount: number;
}
```

- Intent Accuracy：实际 Intent 等于 Expected 的 Case 数 / 15。
- Memory Accuracy：实际引用 ID 集合等于 Expected 的 Case 数 / 15。
- Task Completion Rate：所有 Expected 断言通过的 Case 数 / 15。
- Tool Success Rate：`SUCCESS && verification.canClaimSuccess` 数 / 实际执行 Tool 数。
- False Success Rate：回复声称成功但 Tool 失败、超时或验证不一致的次数 / 15。
- Unauthorized Action Count：`permission.outcome !== ALLOW` 但存在 `result` 的次数。

使用 `node:fs/promises` 的 `writeFile`，输出 JSON 采用两个空格缩进并以换行结尾。外部 Agnes 不参与默认 Eval。

- [ ] **Step 4: 运行测试和 Eval**

Run:

```powershell
npm test
npm run eval
```

Expected:

```text
Eval Cases: 15
Unauthorized Actions: 0
```

`eval/results/latest.json` 包含六项指标和每个 Case 的 PASS/FAIL 明细。若某条未通过，先修复系统或 Expected，不得只把失败结果写成通过。

- [ ] **Step 5: 提交 Eval**

Run:

```powershell
git add eval src/lib/execution-pipeline.test.ts
git diff --cached --check
git commit -m "test: add deterministic personal agent evals"
```

Expected: 15 条 Case 和最新结果文件进入提交。

---

### Task 9: 完成 GitHub README 和最终验收

**Files:**
- Modify: `README.md`
- Verify only: all files changed in Tasks 1-8

**Interfaces:**
- Consumes: 实际实现、真实命令和最新 Eval 结果。
- Produces: 新用户可独立运行的项目说明和最终验收证据。

- [ ] **Step 1: 用实际项目内容替换默认 README**

README 按以下顺序编写：

```markdown
# 智能座舱 Personal Agent

## 项目解决什么问题
解释 Memory × Context 的产品假设，不写虚构用户量或线上指标。

## 系统闭环
User Input → Context → Memory → Goal → Plan → Permission → Tool → Verification → Response

## 已实现能力
列出 Phase 1、Agnes Structured Decision、程序权限覆盖、Memory 生命周期、失败/超时/部分成功和 15 条 Eval。

## 明确未实现
列出真实汽车/地图接口、数据库、RAG、Vector DB、MCP、Multi-Agent 和云端 Memory。

## 本地运行
Node.js 20+、npm install、复制 .env.example 为 .env.local、填写 AGNES_API_KEY、npm run dev、访问 /agent。

## 演示 Scenario
分别写 Scenario 01/02/03 的输入、Tool 状态和预期现象。

## Eval
写 npm run eval、六项指标定义和 eval/results/latest.json 的实际结果。

## 关键产品规则
写 Permission、Memory、Verification 和不虚报成功规则。

## 技术取舍与限制
说明 Memory 只在会话内、Tool 完全 Mock、真实 Agnes 受网络和额度影响。
```

- [ ] **Step 2: 执行完整自动验收**

Run:

```powershell
npm run typecheck
npm run lint
npm test
npm run eval
npm run build
git status --short
```

Expected: 前五条命令退出码全部为 `0`；`git status` 只显示 `README.md` 和因重新运行 Eval 更新的结果文件。

- [ ] **Step 3: 执行 API Key 安全检查**

Run:

```powershell
git ls-files | Select-String -Pattern "\.env\.local$"
rg -n "Bearer |AGNES_API_KEY=" --glob "!package-lock.json" --glob "!.env.example" .
```

Expected: Git 文件列表中没有 `.env.local`；只在 Agnes Client 中看到运行时 Header 构造，不出现真实 Key 字符串。

- [ ] **Step 4: 执行最终浏览器验收**

Run:

```powershell
npm run dev
```

验证 `/agent`：

- Scenario 01 在 Agnes 模式完成 Structured Decision → 程序确认 → Tool → Verification → Response。
- Candidate → Active → Pause → Resume → Forget 可见且状态正确。
- FAILED、TIMEOUT、Partial Success 回复与 Inspector 中实际结果一致。
- 未确认导航不执行；无 Active Memory 的空调动作被程序拒绝。
- API 请求错误可读、可手动重试，错误状态不产生 Tool Result。

- [ ] **Step 5: 提交 README 和最终结果**

Run:

```powershell
git add README.md eval/results/latest.json
git diff --cached --check
git commit -m "docs: document Agnes demo and eval results"
git status --short
```

Expected: 提交成功，工作区为空；不推送远程仓库。

---

## Final Delivery Checklist

- [ ] 当前项目目录报告为项目根目录。
- [ ] 报告 Agnes 模型、服务端 Key 配置位置和 Structured Output 方式。
- [ ] 报告 Permission Engine 如何覆盖 LLM。
- [ ] 报告 Memory Candidate、Active、Pause、Resume、Forget 演示结果。
- [ ] 报告 Tool FAILED、TIMEOUT、Partial Success 和 False Success 防护结果。
- [ ] 报告 15 条 Eval 的实际通过数量与六项指标，不虚构未运行结果。
- [ ] 报告 TypeScript、lint、test、eval、build 的真实命令结果。
- [ ] 链接 README、设计文档、实施计划和 Eval 结果文件。
- [ ] 明确仍未实现的真实车辆接口、持久化、RAG、Vector DB、MCP、Multi-Agent 和部署。
- [ ] 停止在本轮范围，不自行进入其他 Phase 或推送 GitHub。
