# PMWork 开发会话笔记

> 日期：2026-02-06
> 会话内容：Canvas 聊天面板修复与增强

---

## 一、Bug 修复

### 1.1 Chat Panel 拖拽调整高度不跟手

**问题**: `useEffect` 依赖了 `chatPanelHeight`，每次高度变化都重新注册 listener，导致 `lastY` 重置为 0、第一次 move 被跳过，拖拽体感卡顿。

**修复**: 用 `useRef` 保存 `chatPanelHeight`，effect 只依赖 `isDragging`，listener 注册一次、全程不重建。

### 1.2 Canvas 页面加载双调用

**问题**: `loadCanvas` 的 `useCallback` 依赖了 `currentPageId`，首次加载时自动选中第一个 page 会触发依赖变化导致 `loadCanvas` 重新执行。

**修复**: 将"自动选中第一个 page"拆为独立 `useEffect`，从 `loadCanvas` 的依赖中移除 `currentPageId` 和 `setCurrentPage`。

### 1.3 `scrollIntoView` 每次渲染都执行

**问题**: `useEffect` 无依赖数组，每次渲染都滚动到底部。

**修复**: 依赖改为 `[messages]`。

### 1.4 Structured Output "No object generated" 错误

**问题**: 火山引擎 ARK 不支持 `generateObject`（tool mode / json mode）。

**修复**: 创建 `lib/ai/workflow/generate-structured.ts`，用 `generateText` + JSON schema in prompt + 手动 JSON 提取 + Zod 校验实现 provider 无关的结构化输出。更新 `architect.ts`、`planner.ts`、`reviewer.ts` 使用新方案。

### 1.5 History Tab 无法加载

**问题**:
- `timeline.tsx` 请求 `/api/canvas/{canvasId}/history` 但 API 要求 `?versionId=` query param → 400
- API 返回 `{ data: commits }` 但前端直接当 flat array 解析
- Revert 请求只发 `{ commitHash }` 但 API 要求 `{ versionId, pageId, commitHash }` → 400

**修复**: Timeline 组件新增 `versionId` / `pageId` props，从 ChatPanel 传入；修正请求 URL 和 body；修正响应解析 `json.data ?? json`。

---

## 二、新增功能

### 2.1 Iterate 流式进度（SSE）

**之前**: 用户发送消息后只看到静态 "Updating canvas..." + spinner，直到完成。

**现在**: API 改为 SSE 流，发送阶段性状态事件：
- `Analyzing your request...`
- `Generating updated HTML...`
- `Saving changes...`
- `Canvas updated.`（完成）

Chat 气泡实时显示当前阶段。

**文件变更**:
- `app/api/canvas/iterate/route.ts` — `streamText().toTextStreamResponse()` → SSE with ReadableStream
- `components/canvas/chat-panel.tsx` — 读取 SSE 事件并更新 `streamingStatus`

### 2.2 终止生成

用户可以在生成过程中点击红色 Stop 按钮（■）中止请求。

**实现**: `AbortController` ref + `signal` 传给 fetch；Send 按钮在生成时变为 destructive Stop 按钮；捕获 `AbortError` 显示 "Generation stopped."。

### 2.3 拖拽鼠标移出面板自动停止

**问题**: 向上拖拽展开浮窗时，鼠标移出面板外拖拽不会停止。

**修复**: 在 drag effect 中对 panel 元素添加 `mouseleave` 事件监听，鼠标移出即停止拖拽。

### 2.4 撤回上一步改动

每次成功 iterate 后，"Canvas updated." 消息旁边出现 Undo 按钮（↩），点击可撤回本次改动。

**实现**:
- 调用 revert API，`commitHash` 传 `HEAD~1`
- `lib/git/index.ts` 放宽 checkout 校验，接受 git ref（不再要求 ≥7 字符 hash）
- Undo 按钮只出现在最近一次成功 iterate 的消息上，使用或发起新 iterate 后自动消失

---

## 三、文件变更清单

### 新增文件
```
lib/ai/workflow/generate-structured.ts   — Provider 无关的结构化输出
app/api/canvas/workflow/route.ts         — Workflow SSE endpoint
app/api/canvas/[canvasId]/history/       — History API
app/api/canvas/[canvasId]/revert/        — Revert API
components/canvas/chat-panel.tsx         — Chat 浮窗
components/canvas/timeline.tsx           — Git 历史时间线
components/canvas/workflow-progress.tsx  — Workflow 进度 UI
components/canvas/page-tabs.tsx          — 多页 tab
stores/canvas-store.ts                   — Canvas Zustand store
lib/fs/canvas.ts                         — Canvas CRUD
lib/fs/canvas-types.ts                   — Canvas 类型
lib/git/index.ts                         — Git 操作
```

### 修改文件
```
app/api/canvas/iterate/route.ts          — streamText → SSE 流式进度
components/canvas/chat-panel.tsx         — 终止/撤回/拖拽修复/SSE 读取
components/canvas/timeline.tsx           — 传 versionId/pageId 修复
lib/git/index.ts                         — checkout 接受 git ref
lib/ai/workflow/architect.ts             — 使用 generateStructured
lib/ai/workflow/planner.ts               — 使用 generateStructured
lib/ai/workflow/reviewer.ts              — 使用 generateStructured
```

---

## 四、已知遗留问题（非本次引入）

- `components/chat/chat-markdown.tsx` — TS2339 `inline` prop
- `components/files/markdown-preview.tsx` — 同上
- `app/(main)/settings/page.tsx` — Accessibility warnings (fieldset)
- `app/(main)/workspace/[projectId]/[versionId]/page.tsx` — Hook dependency warnings
