# Personal Agent：Agnes Structured Decision 与 Eval 设计

日期：2026-08-08
状态：用户已确认，等待文档复核

## 1. 目标

在现有 Phase 1 三栏 Agent Demo 和完全 Mock 闭环基础上，补齐以下能力：

- 接入真实 Agnes AI，但仍只操作 Mock Tool。
- 使用结构化 `AgentDecision`，拒绝自由文本直接驱动工具。
- 保证程序 Permission Engine 可以覆盖并否决 LLM 决策。
- 补齐 Memory Candidate、Active、Pause、Forget 生命周期。
- 可演示 Tool `FAILED`、`TIMEOUT` 和 Partial Success。
- 建立 15 条确定性 Eval Case 和简单结果报告。
- 将 README 改为可用于 GitHub 项目展示的说明文档。

本次用户的新指令覆盖原先“Phase 1 不调用 LLM”的限制，但不扩大到真实汽车、地图、数据库或后续复杂架构。

## 2. 明确不做

- 不接入 RAG、Vector DB、MCP、Multi-Agent 或数据库。
- 不接入真实汽车、地图、餐厅、充电站接口。
- 不实现登录、多用户、云端 Memory 或跨设备同步。
- 不让 LLM 直接执行 Tool，也不相信 LLM 自报的执行结果。
- 不自动创建 GitHub 远程仓库，不推送或部署。
- 不提前实现原 FINAL V1 中仍属于 Phase 2/3/4、且未被本轮清单明确要求的功能。

## 3. 总体架构

数据流保持冻结需求中的系统闭环：

```text
User Input
  -> Vehicle Context + Relevant Memory
  -> Agnes Structured AgentDecision
  -> Runtime Schema Validation
  -> Program Permission Engine
  -> Mock Tool Execution
  -> State Verification
  -> Deterministic Response Composition
```

关键边界：Agnes 是“决策提案者”，程序是“执行裁决者”。任何 Tool 执行都必须经过结构校验和权限引擎；最终回复以 Tool Result 和 Verification Result 为事实来源。

## 4. Agnes 接入设计

### 4.1 服务端接口

新增 Next.js Route Handler：`POST /api/agent/decision`。

请求只接受：

- 当前用户输入；
- 当前 Vehicle Context；
- 当前有效 Memory；
- 五个 Mock Tool 的能力描述；
- 必要的会话确认状态。

请求体需要做类型、必填项、字符串长度和枚举值校验。客户端不能传入 API Key，也不能指定任意模型或 Agnes URL。

### 4.2 Agnes 调用

- Base URL：`https://apihub.agnes-ai.com/v1`
- Endpoint：`POST /chat/completions`
- Model：`agnes-2.5-flash`
- API Key：服务端环境变量 `AGNES_API_KEY`
- 单次请求超时：20 秒

使用强制函数调用：模型必须调用虚拟函数 `submit_agent_decision`。函数参数使用 `AgentDecision` JSON Schema。该虚拟函数不执行任何业务动作，只负责提交结构化决策。

### 4.3 失败处理

以下情况均不得执行任何 Tool：

- 未配置 `AGNES_API_KEY`；
- Agnes 返回 401、429、5xx 或网络错误；
- 请求超过 20 秒；
- 没有返回 `submit_agent_decision`；
- 函数参数不是合法 JSON；
- 返回内容未通过 `AgentDecision` 运行时校验；
- 决策引用未知 Tool 或不存在的 Memory。

界面显示可理解的错误和“重新尝试”入口。本阶段不做自动无限重试；由用户手动重试，避免重复决策或重复动作。

## 5. AgentDecision Structured Schema

在现有类型上收敛为版本化结构，至少包含：

```ts
interface AgentDecision {
  schemaVersion: "1.0";
  intent: string;
  goal: string;
  plan: Array<{
    stepId: string;
    description: string;
    toolName?: MockToolName;
  }>;
  memoryReferences: string[];
  proposedToolCalls: Array<{
    callId: string;
    toolName: MockToolName;
    arguments: Record<string, unknown>;
    expectedStateChange?: Record<string, unknown>;
  }>;
  requiresConfirmation: boolean;
  confirmationPrompt?: string;
  responseDraft: string;
}
```

运行时校验规则：

- `schemaVersion` 必须严格为 `1.0`；
- `plan`、`proposedToolCalls` 设置合理数量上限，防止异常大响应；
- Tool 名必须属于现有五个 Mock Tool；
- 每个 Tool 参数按各自定义继续校验；
- `memoryReferences` 只能引用当前传给模型的 Memory ID；
- 高风险动作即使 `requiresConfirmation=false`，程序仍强制确认；
- `responseDraft` 只能用于执行前说明，不能覆盖程序生成的最终执行结果。

## 6. Permission Engine

Permission Engine 仍是确定性纯函数，输入为 Vehicle Context、用户授权状态和单个 Proposed Tool Call，输出为：

- `ALLOW`
- `REQUIRE_CONFIRMATION`
- `DENY`

规则：

1. 读取类 Tool 可直接执行。
2. 低风险写操作仅在当前场景授权且可撤销时允许。
3. 高风险或规则判定需要确认的动作必须暂停，等待用户明确确认。
4. 未知 Tool、参数越界、与 Vehicle Context 冲突的动作直接拒绝。
5. LLM 的权限判断只作参考，程序结论始终覆盖 LLM。
6. 被拒绝或待确认的 Tool 不得进入执行函数。

## 7. Memory 生命周期

Memory 继续使用前端会话内 Mock 状态，不引入持久化层。

状态变化：

```text
TEMPORARY -> CANDIDATE -> ACTIVE -> SUSPENDED
                       \-> DELETED
ACTIVE -> DELETED
SUSPENDED -> ACTIVE
SUSPENDED -> DELETED
```

产品规则：

- 相同偏好在演示逻辑中累计达到 3 次后，从 Temporary 形成 Candidate。
- Candidate 不可自动用于敏感或个性化动作；用户点击确认后才成为 Active。
- Active Memory 可以进入相关性筛选并传给 Agnes。
- Pause 将状态设为 Suspended；Suspended 不参与决策。
- Forget 将状态设为 Deleted；Deleted 不参与决策，也不在默认 Memory 列表中展示。
- 本阶段刷新页面后 Memory 可重置，README 明确说明这一限制。

## 8. Mock Tool、Verification 与真实回复

保留现有五个 Mock Tool：

- `getVehicleState`
- `setClimateTemperature`
- `setNavigation`
- `searchEnergyStation`
- `searchRestaurant`

每个 Tool 可手动选择 `SUCCESS`、`FAILED`、`TIMEOUT`，便于稳定复现异常。

执行顺序：

1. Permission Engine 逐项裁决。
2. 仅执行 `ALLOW` 的 Tool。
3. Tool 返回标准化状态和可选观测状态。
4. `SUCCESS` 后运行 State Verification，对比期望状态和观测状态。
5. 根据全部实际结果生成最终回复。

最终回复规则：

- 全部成功且验证通过：明确说明完成。
- Tool 返回 `FAILED`：明确说明该项失败，不得报成功。
- Tool 返回 `TIMEOUT`：说明结果未知，不得推断完成。
- 一部分成功、一部分失败或超时：逐项说明 Partial Success。
- Tool 自报成功但验证不通过：视为未验证成功，提醒状态不一致。

## 9. 演示场景

### Scenario 01：今晚还是老样子吧

复用 Phase 1 场景。真实 Agnes 根据当前 Context 和 Active Memory 生成 Goal、Plan 和 Proposed Tool Calls；程序完成权限确认、Mock Tool 执行、验证与真实回复。

### Scenario 02：空调 24℃ 就行

连续演示相同偏好：

1. 前两次仅累计观察。
2. 第三次形成 Candidate 并提示确认。
3. 用户确认后变为 Active。
4. 后续相关请求可引用该偏好。
5. Pause 后不再使用；恢复后可再次使用；Forget 后不再使用。

### Scenario 03：回家，把空调调到 24℃

- 导航 `SUCCESS`、空调 `FAILED`：回复“导航已设置，空调设置失败”。
- 导航 `SUCCESS`、空调 `TIMEOUT`：回复“导航已设置，空调结果未知”。
- 权限不满足时，禁止未授权 Tool，即使 Agnes 请求执行。

## 10. UI 改动范围

在现有三栏 Skeleton 内最小增量修改：

- Chat Panel：增加真实 Agnes / Phase 1 Mock 决策模式标识、请求中、错误和重试状态。
- Context Panel：保留 Vehicle Context 手动调整能力。
- Inspector Panel：展示结构化 Decision、Permission 裁决、Tool Result、Verification Result；增加 Memory Confirm、Pause、Resume、Forget 控件。
- Tool 状态控制：继续允许手动选择 `SUCCESS`、`FAILED`、`TIMEOUT`。

不重新设计整体视觉，不新增页面体系。

## 11. Eval 设计

建立 15 条固定 Eval Case：

- Normal：3 条
- Ambiguous：2 条
- Memory：3 条
- Tool Failure / Timeout / Partial Success：3 条
- Permission：2 条
- Replanning / Verification：2 条

每条 Case 包含输入 Context、Memory、Tool 状态和期望断言。Eval 采用确定性程序判定，不使用 LLM-as-Judge。

输出指标：

- Intent Accuracy
- Memory Accuracy
- Task Completion Rate
- Tool Success Rate
- False Success Rate
- Unauthorized Action Count

实现一个轻量 TypeScript Eval Runner，复用项目中的权限、工具和验证逻辑，生成终端摘要和 `eval/results/latest.json`。只增加轻量开发依赖 `tsx`，不引入测试框架或评测平台。

说明：真实 Agnes 输出存在波动，因此默认 Eval 主要验证确定性系统边界；另外提供可选 Agnes smoke case，只在存在 API Key 时手动运行，不将外部 API 稳定性混入本地固定分数。

## 12. README

README 至少包含：

- 项目问题与核心假设；
- 系统闭环和架构；
- 已实现能力与明确未实现内容；
- 安装、`.env.local` 配置和启动方法；
- Scenario 01/02/03 演示步骤；
- 15 条 Eval 的运行方法和当前结果；
- Permission、Memory、Verification 的关键产品规则；
- 安全说明、已知限制和技术取舍。

README 不写虚构上线数据、用户规模或性能指标。

## 13. 安全与配置

- `.env.local` 必须由 `.gitignore` 排除。
- 提供 `.env.example`，只包含 `AGNES_API_KEY=` 占位符。
- 日志不得输出 API Key、Authorization Header 或完整敏感请求。
- Agnes 请求仅发生在服务端 Route Handler。
- 对用户输入、LLM 输出、Tool 参数都设置校验和长度边界。

## 14. 验收标准

完成实施后必须满足：

1. `npm run typecheck` 通过。
2. `npm run lint` 通过。
3. `npm run build` 通过。
4. `npm run eval` 能运行 15 条 Case 并生成简单结果。
5. 配置有效 Agnes Key 后，Scenario 01 可走真实 Structured Decision。
6. Scenario 02 可完整演示 Candidate、Active、Pause、Resume、Forget。
7. Scenario 03 可稳定演示 FAILED、TIMEOUT 和 Partial Success。
8. 高风险或未授权动作无法被 LLM 绕过。
9. Tool 失败、超时或验证不通过时，不出现虚假成功回复。
10. README 能让新用户独立完成安装和演示。

## 15. 预期文件改动

实施阶段预计只修改或新增以下范围：

- `src/app/api/agent/decision/route.ts`
- `src/components/agent/*` 中与本轮交互有关的文件
- `src/domain/agent.ts`
- `src/lib/agent-decision-schema.ts`
- `src/lib/agnes-client.ts`
- `src/lib/permission-engine.ts`
- `src/lib/state-verification.ts`
- `src/lib/memory-engine.ts`
- `src/lib/response-composer.ts`
- `eval/*`
- `scripts/run-eval.ts`
- `.env.example`
- `package.json`
- `README.md`

实际实施时如发现现有文件职责不同，只做完成需求所需的最小调整，不进行全局重构。
