# Personal Agent Phase 4 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 完成冻结 FINAL V1 的 Voice Mode、5～8 页 PRD、必要 UI 微调、Preview 部署和公开验收，并在完成后停止扩展。

**Architecture:** Voice Mode 仅在浏览器端工作：独立纯函数模块负责 Web Speech 构造器选择、最终转写提取和错误映射，React Hook 管理识别生命周期，Chat Panel 只展示状态并回填输入。Agent Decision、Permission、Tool、Verification 和 Memory 链路保持不变。PRD 由 Markdown 作为事实源，生成固定 6 页 PDF；部署复用现有 Vercel Preview。

**Tech Stack:** Next.js 16.3.0、React 19、TypeScript 5、Tailwind CSS 4、浏览器 Web Speech API、Python/ReportLab（仅用于生成文档，不进入应用运行时）、Vercel Preview。

## Global Constraints

- 不新增 npm 依赖，不接入付费语音模型、语音合成或音频上传。
- 识别结果只回填输入框，不自动发送，不绕过 Permission 和确认流程。
- 不修改 Agent Decision、Memory、Tool 或 Verification 业务规则。
- 不部署 Production，不扩大 `AGNES_API_KEY` 的 Preview 授权范围。
- 只做 Voice 状态和小屏溢出所需 UI 微调，不重做三栏布局。
- 所有新 TypeScript 源文件控制在 300 行以内。

---

### Task 1: 冻结 Phase 4 规格

**Files:**
- Modify: `docs/superpowers/specs/2026-08-08-agnes-agent-eval-design.md`
- Modify: `docs/superpowers/specs/Product-Spec-CHANGELOG.md`
- Create: `docs/superpowers/plans/2026-08-09-personal-agent-phase4.md`

**Interfaces:**
- Consumes: FINAL V1 Phase 4 冻结条目和用户确认的推荐方案。
- Produces: Voice、PRD、部署和验收的唯一实施边界。

- [ ] **Step 1: 更新设计文档**

写入以下不可变规则：单句 `zh-CN`、识别只回填、错误回退文本、PRD 同时交付 Markdown/PDF、仅 Preview 部署、完成后 V1 COMPLETE。

- [ ] **Step 2: 更新变更记录**

追加 `v1.3 - 2026-08-09`，记录 Chat Panel 麦克风、浏览器降级、PRD 和 Preview 验收。

- [ ] **Step 3: 检查边界**

Run: `rg -n "Voice Mode|不自动发送|5～8 页|Preview|V1 COMPLETE" docs/superpowers/specs`

Expected: 五项边界均有明确命中，不出现 Production 部署授权。

### Task 2: 测试驱动实现 Voice Mode

**Files:**
- Create: `src/lib/speech-recognition.test.ts`
- Create: `src/lib/speech-recognition.ts`
- Create: `src/components/agent/use-speech-input.ts`
- Modify: `src/components/agent/chat-panel.tsx`

**Interfaces:**
- Consumes: `ChatPanelProps.onInputChange(value: string)` 和现有输入禁用状态。
- Produces: `resolveSpeechRecognitionConstructor(runtime)`、`extractFinalTranscript(event)`、`getSpeechRecognitionErrorMessage(code)`、`useSpeechInput(onTranscript)`。

- [ ] **Step 1: 写失败测试**

```ts
import assert from "node:assert/strict";
import test from "node:test";

import {
  extractFinalTranscript,
  getSpeechRecognitionErrorMessage,
  resolveSpeechRecognitionConstructor,
} from "./speech-recognition";

test("优先标准构造器并兼容 webkit 前缀", () => {
  class StandardRecognition {}
  class WebkitRecognition {}
  assert.equal(
    resolveSpeechRecognitionConstructor({
      SpeechRecognition: StandardRecognition,
      webkitSpeechRecognition: WebkitRecognition,
    }),
    StandardRecognition,
  );
  assert.equal(
    resolveSpeechRecognitionConstructor({
      webkitSpeechRecognition: WebkitRecognition,
    }),
    WebkitRecognition,
  );
  assert.equal(resolveSpeechRecognitionConstructor({}), null);
});

test("只组合最终识别结果", () => {
  const transcript = extractFinalTranscript({
    resultIndex: 0,
    results: [
      { isFinal: true, 0: { transcript: "今晚还是" }, length: 1 },
      { isFinal: false, 0: { transcript: "临时文字" }, length: 1 },
      { isFinal: true, 0: { transcript: "老样子吧" }, length: 1 },
    ],
  });
  assert.equal(transcript, "今晚还是老样子吧");
});

test("把权限、无语音、音频和网络错误映射为中文", () => {
  assert.match(getSpeechRecognitionErrorMessage("not-allowed"), /麦克风权限/);
  assert.match(getSpeechRecognitionErrorMessage("no-speech"), /没有识别到/);
  assert.match(getSpeechRecognitionErrorMessage("audio-capture"), /麦克风/);
  assert.match(getSpeechRecognitionErrorMessage("network"), /网络/);
});
```

- [ ] **Step 2: 确认测试先失败**

Run: `npm.cmd test`

Expected: FAIL，原因是 `speech-recognition` 模块尚不存在。

- [ ] **Step 3: 实现纯函数和 Hook**

`speech-recognition.ts` 定义最小浏览器接口，不依赖第三方类型；构造器优先 `SpeechRecognition`，回退 `webkitSpeechRecognition`；仅提取 `isFinal=true` 的文字；错误信息不得抛到页面导致崩溃。

`use-speech-input.ts` 在 `useEffect` 中创建实例并设置：

```ts
recognition.lang = "zh-CN";
recognition.continuous = false;
recognition.interimResults = false;
recognition.maxAlternatives = 1;
```

Hook 必须在卸载时 `abort()` 并移除事件处理器；`start()` 同步抛错时转为中文错误状态。

- [ ] **Step 4: 接入 Chat Panel**

输入框右侧依次放置麦克风和发送按钮。麦克风使用 `aria-pressed`、动态 `aria-label`；监听时禁用发送；不支持时禁用麦克风并显示“请继续使用文本输入”。识别完成只调用 `onInputChange(transcript)`。

- [ ] **Step 5: 后绿检查**

Run: `npm.cmd test && npm.cmd run typecheck && npm.cmd run lint`

Expected: 全部退出码 0。

### Task 3: 编写并生成 6 页 PRD

**Files:**
- Create: `docs/Personal-Agent-PRD.md`
- Create: `output/pdf/Personal-Agent-PRD.pdf`
- Modify: `README.md`

**Interfaces:**
- Consumes: 当前代码、20 条 Eval 结果和已完成的三个 Scenario。
- Produces: GitHub 可读 PRD 源文件与固定 6 页交付 PDF。

- [ ] **Step 1: 编写 Markdown 事实源**

按以下六页结构组织内容：

1. 产品问题、目标用户、核心假设和完成线。
2. 三栏界面、系统闭环、Agnes 与程序的职责边界。
3. Scenario 01/02/03 的输入、关键判断和预期输出。
4. Memory 生命周期、Permission 规则、Tool 状态和 Verification。
5. 20 条 Eval 分布、1.0000/0.7692/0 指标和解释。
6. MVP 取舍、风险、明确未实现内容、演示与仓库链接。

- [ ] **Step 2: 生成 PDF**

使用 ReportLab 创建 A4 竖版 PDF，固定 6 页，中文字体、页眉、页码、统一青色强调；不把生成器加入应用依赖。

- [ ] **Step 3: 视觉检查**

Run: `pdftoppm -png -r 150 output/pdf/Personal-Agent-PRD.pdf tmp/pdfs/personal-agent-prd`

Expected: 生成 6 张 PNG；逐页无文字截断、重叠、黑方块或乱码。

- [ ] **Step 4: 更新 README**

增加 Voice Mode 使用/降级说明、PRD Markdown/PDF 链接和 Phase 4 完成状态；保留 Preview 而非 Production 表述。

### Task 4: 本地完整验收和安全检查

**Files:**
- Verify only: project source, docs, generated results and PDF。

**Interfaces:**
- Consumes: Task 1～3 的全部产物。
- Produces: 可提交且无敏感信息的 Phase 4 版本。

- [ ] **Step 1: 自动检查**

Run:

```powershell
npm.cmd test
npm.cmd run test:python
npm.cmd run eval
npm.cmd run eval:python
npm.cmd run typecheck
npm.cmd run lint
npm.cmd run build
```

Expected: TypeScript 与 Python 测试全过，Eval 20/20，lint/typecheck/build 退出码 0。

- [ ] **Step 2: 本地浏览器检查**

验证文本输入、Mock Scenario 01、麦克风按钮状态、识别只回填、不支持/拒绝权限时文本降级，以及 1280px 和窄屏无横向内容截断。

- [ ] **Step 3: 安全检查**

确认 `.env.local` 未跟踪，仓库不存在真实 Key、Authorization 值、Windows 本地绝对路径、`.vercel` 或 Python 缓存。

### Task 5: 提交、Preview 部署与公开 Smoke Test

**Files:**
- Commit only: Task 1～3 明确列出的 Phase 4 文件。

**Interfaces:**
- Consumes: 本地验收通过的提交。
- Produces: GitHub `main` 提交、公开 Vercel Preview 和验收记录。

- [ ] **Step 1: 精确提交并推送**

Commit: `feat: complete personal agent v1 presentation`

- [ ] **Step 2: Preview 部署**

Run from the repository root: `vercel deploy . -y`

Expected: 返回新的 Preview URL；不得使用 `--prod`。

- [ ] **Step 3: 公开 Smoke Test**

使用全新浏览器会话打开 Preview `/agent`，确认无需登录、页面加载、Voice 支持或文本降级、Mock Scenario 01 可完成；再检查 GitHub README、PRD 和结果链接。

- [ ] **Step 4: 完成线**

公开验收通过后，将规格状态和 README 标记为 `V1 COMPLETE`；不继续创建 Phase 5。
