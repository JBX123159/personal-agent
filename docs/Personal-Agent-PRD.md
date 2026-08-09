# 智能座舱 Personal Agent｜V1 产品需求文档

版本：FINAL V1

日期：2026-08-10

状态：V1 COMPLETE（完成 Phase 4 公开验收后生效）

产品形态：可交互 Web Demo

核心命题：Memory × Vehicle Context 驱动的安全车载 Agent

## 1. 产品摘要

### 1.1 用户问题

传统车载助手擅长执行“打开空调”“导航回家”这类单条指令，却很难安全处理“今晚还是老样子吧”这样的目标表达。真正的 Personal Agent 必须同时回答：当前车辆状态是否适合执行、哪些历史偏好已经获得用户确认、一次目标需要哪些步骤、哪些动作必须再次确认，以及工具返回成功后车辆状态是否真的符合预期。

### 1.2 核心假设

如果系统把实时 Vehicle Context 与用户明确确认的长期 Memory 组合成 Goal 和 Plan，再由程序化 Permission Engine、Tool Result 和 State Verification 掌握执行权，就能在提供个性化体验的同时避免模型越权和虚假成功。

### 1.3 目标用户与使用价值

主要用户是存在固定通勤、温度、餐厅或补能偏好的新能源车驾驶者。用户不需要逐条重复指令，只需表达目标；系统负责解释上下文、引用已确认偏好、形成计划并在关键动作前征求确认。该 Demo 同时面向产品和工程评审者，用于验证方案是否可解释、可授权、可复现，而不是证明真实车辆控制能力。

### 1.4 V1 成功标准

- 三个固定 Scenario 可以在 Mock 模式稳定演示。
- Agnes 只提出结构化 AgentDecision，不能直接执行 Tool。
- Permission、FAILED、TIMEOUT、Partial Success 和 Verification 真实生效。
- Memory 支持 Candidate、Active、Edit、Pause、Resume 和 Forget。
- 20 条确定性 Eval 可由 TypeScript 执行并由 Python 独立复算。
- Voice Mode 在支持浏览器中回填文字，在不支持或失败时回退文本。
- 有公开 GitHub、无需登录的在线 Demo、README 和 5～8 页 PRD。

<!-- PDF_PAGE_BREAK -->

## 2. 产品结构与系统闭环

### 2.1 三栏 Demo

- 左栏 Vehicle Context：展示并允许手动修改时间、位置、电量、舱温、乘客模式、天气和当前路线。修改后再次运行，Agent 必须根据新 Context 重新判断。
- 中栏 Personal Agent：支持文本输入、Voice Mode、Agnes/Mock 模式切换、错误重试和高影响方案确认。Voice 识别结果只进入输入框，不自动发送。
- 右栏 Agent Inspector：只保留 Context、Memory、Goal、Plan、Tools、Safety/Eval 六个视图，逐层解释本轮看到了什么、引用了什么、为何执行以及结果是否可信。

### 2.2 决策与执行链

```text
User Input
  -> Vehicle Context + Active Memory
  -> Goal + Structured Plan
  -> Program Permission
  -> Mock Tool Execution
  -> State Verification
  -> Deterministic Response
```

真实 Agnes 路径要求模型调用 `submit_agent_decision`，返回版本化 AgentDecision。运行时 Schema 会拒绝未知字段、未知 Tool、非法参数、重复标识和未提供给 Agnes 的 Memory 引用。通过 Schema 只代表“提案格式合法”，不代表获得执行权限。

### 2.3 职责边界

- Agnes：理解自然语言，提出 intent、goal、plan、memoryReferences 和 proposedToolCalls。
- Permission Engine：根据 Tool 类型、当前 Context、Active Memory 和本轮用户确认做 ALLOW、DENY 或 REQUIRE_CONFIRMATION。
- Mock Tool：产生 SUCCESS、FAILED 或 TIMEOUT，以及可验证的观测状态。
- State Verification：比较 expectedStateChange 与 observedState，识别工具自报成功但实际状态不一致。
- Response Composer：只根据真实执行和验证结果生成最终回复，不采用执行前草稿冒充完成结果。

### 2.4 Voice Mode

Voice Mode 使用浏览器 `SpeechRecognition`，兼容 `webkitSpeechRecognition` 前缀，固定单句中文识别。监听期间禁止发送旧输入；最终文字回填后仍需用户检查并主动点击发送。浏览器不支持、麦克风权限被拒绝、没有识别到语音、无可用麦克风或网络失败时，系统提供明确中文提示并继续保留文本输入。V1 不接入付费语音模型、语音合成或音频存储。

<!-- PDF_PAGE_BREAK -->

## 3. 核心 Scenario

### 3.1 Scenario 01：今晚还是老样子吧

默认 Context 为周五 17:40、Office、电量 19%、Owner Only、舱温 31℃。系统引用已确认的周五健身、餐厅、低电量补能和夏季 24℃ Memory，形成读取车辆、查询补能站、查询餐厅、设置导航和设置空调的计划。

读取和查询 Tool 可先执行；导航属于高影响写操作，程序必须等待本轮用户确认，即使 Agnes 声称无需确认也不能绕过。用户点击“确认并执行方案”后，写 Tool 才执行。所有成功结果仍要通过 Verification，最终才能回复完成。

Context 变化必须改变决策：当电量为 80% 时不查询补能站；当时间或位置不符合周五下班场景、或缺少核心健身 Routine 时，只要求用户澄清，不猜测路线；Guest 模式不应用仅限车主的个性化空调偏好。

### 3.2 Scenario 02：空调 24℃ 就行

系统把相同偏好视为观察而不是立即形成长期事实。第一次和第二次输入只累计 Temporary 观察；第三次形成 Candidate，并明确提示用户确认。Candidate 不能授权个性化空调写操作，只有用户点击确认后才成为 Active。

Active Memory 可以编辑。温度类内容必须保留 -20～60℃ 的有效温度，保存时同步更新结构化 `context.temperature`；删除温度或输入非法范围时拒绝保存且不破坏原记录。Pause 后变为 Suspended，不再参与决策；Resume 后恢复 Active；Forget 后变为 Deleted，不展示、不传给 Agnes、也不能授权 Tool。

### 3.3 Scenario 03：回家，把空调调到 24℃

该场景用于证明异常不是“统一报错”。导航和空调分别拥有 callId、Permission、Tool Result 和 Verification：

- 导航 SUCCESS、空调 FAILED：回复导航已完成、空调执行失败，整体为 Partial Success。
- 导航 SUCCESS、空调 TIMEOUT：回复导航已完成、空调结果未知，不把超时解释为成功。
- 导航 SUCCESS 但观测路线与目标不一致：明确说明状态验证不一致。
- 空调缺少匹配当前 Context 的 Active Memory：程序 DENY，工具函数不被调用。

<!-- PDF_PAGE_BREAK -->

## 4. 核心产品规则

### 4.1 Memory

Memory 由 id、type、status、content、source、confidence、userConfirmed 和可选 context 组成。V1 只在浏览器会话中维护 Mock Memory，刷新页面会重置，不伪装成跨设备长期记忆。

```text
TEMPORARY -> CANDIDATE -> ACTIVE -> SUSPENDED
                       \-> DELETED
ACTIVE -> DELETED
SUSPENDED -> ACTIVE / DELETED
```

只有 `status=active` 且 `userConfirmed=true` 的 Memory 才能进入相关性选择并发送给 Agnes。候选、暂停和删除状态不得隐式复活。温度、乘客模式等结构化范围必须与当前 Vehicle Context 和 Tool 参数同时匹配。

### 4.2 Permission

- 读取类 Tool 可以直接执行。
- 低风险、可撤销的写操作必须存在匹配当前 Context 的 Active、已确认 Memory。
- 导航等高影响动作必须获得本轮明确确认。
- 参数越界、未知 Tool、Memory 不匹配或乘客范围冲突时直接 DENY。
- LLM 的 `requiresConfirmation` 只是提案，程序结论始终覆盖模型。
- DENY 或 REQUIRE_CONFIRMATION 的调用不会进入工具执行函数。

### 4.3 Tool 与 Verification

V1 固定五个 Mock Tool：`getVehicleState`、`setClimateTemperature`、`setNavigation`、`searchEnergyStation`、`searchRestaurant`。每个 Tool 均可手动选择 SUCCESS、FAILED 或 TIMEOUT，用于可重复演示异常。

SUCCESS 不是终点。写 Tool 返回后必须比较期望状态和观测状态；不一致时禁止声称完成。FAILED 明确报告失败，TIMEOUT 明确报告结果未知；多个调用结果不同则逐项组合 Partial Success。相同 Tool 的多次调用按 callId 绑定，避免结果串线。

### 4.4 安全与数据边界

Agnes Key 只存在于服务端环境变量；客户端无法指定模型、Base URL 或 Key。请求输入、LLM 输出和 Tool 参数均有类型、枚举、数量和长度边界。仓库只提交 `.env.example`，不提交 `.env.local`、真实密钥、Authorization Header、本地路径或部署状态目录。

<!-- PDF_PAGE_BREAK -->

## 5. Eval 与实际结果

### 5.1 评测方法

默认 Eval 不调用 Agnes，也不使用 LLM-as-Judge。TypeScript Runner 复用真实 Permission、Tool、Verification 和 Response Composer，确保测试的是程序边界；Python 标准库脚本再次调用 Runner，并独立检查 Case 总数、分类数量、ID 唯一性和指标计算，避免只凭界面演示判断质量。

20 条 Case 分布：

- Normal 4：固定例程、车辆状态读取、高电量跳过补能、Active 空调偏好。
- Ambiguous 3：Context 不匹配、缺少核心 Routine、未知指令澄清。
- Memory 4：Candidate、Active、Suspended、乘客范围冲突。
- Tool 4：导航或空调 FAILED/TIMEOUT、Partial Success。
- Permission 3：导航等待确认、确认前读取、无授权空调拒绝。
- Verification 2：空调或导航期望状态与观测状态不一致。

### 5.2 当前指标

- Eval Case：20 / 20 符合预期。
- Intent Accuracy：1.0000。
- Memory Accuracy：1.0000。
- Task Completion Rate：1.0000。
- Tool Success Rate：0.7692，即 20 / 26。
- False Success Rate：0.0000。
- Unauthorized Action Count：0。

Tool Success Rate 不是 1.0000，因为测试集故意包含 FAILED、TIMEOUT 和 Verification mismatch。这里的“Case 通过”表示系统按预期拒绝、等待确认或如实报告异常，而不是每个 Tool 都成功。更重要的安全指标是虚假成功为 0、未授权动作数为 0。

### 5.3 评测限制

固定 Eval 证明规则实现具有确定性，不能代表真实地图、车辆总线或 Agnes 上游的 SLA。真实 Agnes 输出和网络存在波动，因此只做人工 smoke，不把外部 API 稳定性混入固定分数。当前指标也不是用户量、商业结果或真实驾驶安全认证。

<!-- PDF_PAGE_BREAK -->

## 6. MVP 取舍、交付与完成线

### 6.1 V1 已实现

- Next.js + TypeScript + Tailwind 三栏可交互 Demo。
- 真实 Agnes Structured Decision 与本地稳定 Mock 双路径。
- 程序化 Permission、五个 Mock Tool、State Verification 和真实结果回复。
- Memory 完整控制与三个固定 Scenario。
- 20 条确定性 Eval、Python 复算、公开 GitHub 和 Vercel Preview。
- Web Speech 单句中文输入与文本降级。

### 6.2 明确不做

V1 不接入真实汽车、地图、餐厅、充电站、数据库、登录、多用户、云端 Memory、RAG、Vector DB、MCP、Multi-Agent、人脸识别、手机 App、模型微调或复杂语音模型。它也不声称生产 SLA、真实用户规模、性能数据或商业效果。

这些取舍不是“以后一定补齐”的路线承诺，而是为了让当前原型集中证明五件事：问题适合 Agent、Memory 与 Context 有真实作用、程序能约束模型、异常不会被包装成成功、评测可以复现。

### 6.3 演示顺序

1. 打开公开 `/agent`，切换到 Phase 1 Mock，保持默认 Context。
2. 演示 Scenario 01 的计划可见、读取先执行、导航强制确认和验证闭环。
3. 重置后演示 Scenario 02 的 Candidate、Confirm、Edit、Pause、Resume、Forget。
4. 重置后设置 Tool FAILED/TIMEOUT，演示 Scenario 03 的 Partial Success。
5. 展示 20 条 Eval 结果和 Python 独立摘要。
6. 在支持浏览器中点击麦克风，说出单句指令；确认文字仅被填入，没有自动发送。若浏览器不支持，则展示明确文本降级。

### 6.4 风险和验收

Web Speech API 兼容性有限，部分浏览器可能使用在线识别服务，因此页面不承诺离线识别或音频隐私能力。真实 Agnes 可能出现超时、上游错误或结构化响应不合规；这些回合必须停止在 Tool 执行前，并允许用户手动重试。

交付以仓库 README 为入口，包含在线 Demo、PRD Markdown、PRD PDF、Eval JSON 和运行命令。公开 Preview 必须无需登录，GitHub 必须不存在密钥和本地环境信息。以上完成后标记 `V1 COMPLETE`，禁止继续无限开发。

## 参考入口

- GitHub：https://github.com/JBX123159/personal-agent
- 在线 Demo：以仓库 README 的“在线链接”为准
- Web Speech API：https://developer.mozilla.org/docs/Web/API/SpeechRecognition
