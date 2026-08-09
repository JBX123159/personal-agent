# 变更记录

## [v1.3] - 2026-08-10

### 新增

- 新增 Chat Panel 输入区右侧的 Voice Mode 按钮，使用浏览器 Web Speech API 完成单句中文识别并回填输入框。
- 新增不支持浏览器、麦克风权限拒绝、无语音和网络错误的文本降级规则。
- 新增 5～8 页 PRD Markdown、PDF 以及公开 Preview Smoke Test 交付要求。

### 修改

- 将项目状态从 Phase 3 完成更新为 Phase 4 展示实施，并明确完成后停止 V1 开发。
- 部署范围限定为现有 Vercel Preview，不扩大 API Key 到 Production 环境。
- 调整 Agent Inspector 的窄屏 Tab 布局为 3×2，避免六个标签压缩后覆盖结果内容；宽屏仍保持标签区与内容区并列。

---

## [v1.2] - 2026-08-09

### 新增

- 新增 5 条确定性 Eval Case，总数扩展到 20 条。
- 新增只使用标准库的 Python Eval 指标复算脚本和独立结果文件。

### 修改

- Eval 分类数量、README 命令和验收标准更新为 Phase 3 范围。

---

## [v1.1] - 2026-08-09

### 新增

- 新增 Inspector > Memory 卡片内联编辑控件，支持保存和取消。
- 新增温度类 Memory 内容与 `context.temperature` 同步校验。

### 修改

- Memory 控制由 Confirm、Pause、Resume、Forget 补齐为包含 Edit 的完整 Phase 2 控制。

---

## [v1.0] - 2026-08-08

- 初始 Agnes Structured Decision 与 Eval 设计确认。
