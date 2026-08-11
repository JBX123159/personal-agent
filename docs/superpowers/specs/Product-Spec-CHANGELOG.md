# 变更记录

## [v1.5] - 2026-08-11

### 修改

- 新增 EdgeOne Production 镜像，供中国大陆用户在不依赖 VPN 的情况下访问既有 `/agent` Demo。
- 仅在 EdgeOne 镜像保存 `AGNES_API_KEY` 敏感环境变量；Vercel 继续保持 Preview，不部署 Vercel Production。
- 不新增业务能力、不修改 Agent 决策、权限、工具或状态验证规则。

---

## [v1.4] - 2026-08-11

### 修改

- 新增最小 `vercel.json`，保持 Next.js 框架不变，并把现有 Vercel Node.js 决策函数部署区域设置为新加坡 `sin1`。
- 本次只优化中国大陆用户访问 Agnes 决策接口的网络路径，不新增业务能力、不复制密钥到 Production，也不进入 Phase 5。

---

## [v1.3] - 2026-08-11

### 新增

- 新增 Chat Panel 输入区右侧的 Voice Mode 按钮，使用浏览器 Web Speech API 完成单句中文识别并回填输入框。
- 新增不支持浏览器、麦克风权限拒绝、无语音和网络错误的文本降级规则。
- 新增 5～8 页 PRD Markdown、PDF 以及公开 Preview Smoke Test 交付要求。

### 修改

- 将项目状态从 Phase 3 完成更新为 Phase 4 展示实施，并明确完成后停止 V1 开发。
- 部署范围限定为现有 Vercel Preview，不扩大 API Key 到 Production 环境。
- 调整 Agent Inspector 的窄屏 Tab 布局为 3×2，避免六个标签压缩后覆盖结果内容；宽屏仍保持标签区与内容区并列。
- 将 Vercel 项目框架预设从 `Other` 修正为 `Next.js`，恢复 Preview 页面与函数产物绑定。
- 记录公开 Preview 地址与 Smoke Test 结果，并将项目状态更新为 V1 COMPLETE。

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
