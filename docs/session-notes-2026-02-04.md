# PMWork 开发会话笔记

> 日期：2026-02-04
> 会话内容：MVP 实现 + 设置功能

---

## 一、架构变更（重要）

### 1.1 存储方案变更

**原计划**: Supabase (PostgreSQL) + Supabase Storage

**实际实现**: 本地文件系统

| 层级 | 原计划 | 实际 |
|------|--------|------|
| 数据库 | Supabase PostgreSQL | JSON 文件 |
| 文件存储 | Supabase Storage | 本地文件系统 |
| ORM | Drizzle | 直接文件读写 |

**原因**: MVP 阶段简化，无需远程数据库部署，数据全部存储在本地。

**文件结构**:
```
pmwork/
├── projects/                    # 项目数据
│   └── {project-slug}/
│       ├── meta.json            # 项目元数据
│       └── {version-slug}/
│           ├── meta.json        # 版本元数据
│           ├── spec.md          # PRD 文档
│           ├── sessions/        # 对话记录
│           │   └── {session-id}.json
│           ├── assets/          # 素材文件
│           └── references/      # 引用资料
├── inbox/                       # 全局收件箱
│   └── {item-id}.json
└── settings.json                # 全局设置
```

### 1.2 全局 Inbox

**原计划**: Inbox 与 Project 关联

**实际实现**: 全局 Inbox，存储在 `/inbox/` 目录

**原因**: 简化 MVP，让用户可以在没有项目的情况下也能收集想法。

---

## 二、新增功能：文件夹选择器

### 2.1 功能描述

取代原计划的项目列表页面，实现了本地文件系统浏览器：

- 用户可以浏览本地文件夹
- 自动识别 PMWork 项目文件夹（黄色图标）和版本文件夹（蓝色图标）
- 点击版本文件夹直接打开工作区
- 点击普通文件夹可以选择在此创建新项目
- 最近打开的文件夹保存在 localStorage

### 2.2 相关文件

```
app/api/folder/browse/route.ts   # 浏览目录 API
app/api/folder/detect/route.ts   # 检测文件夹类型 API
app/api/folder/init/route.ts     # 初始化项目 API
components/workspace/folder-selector.tsx  # 文件夹选择器组件
stores/app-store.ts              # useWorkspaceStore (localStorage 持久化)
```

---

## 三、新增功能：设置页面

### 3.1 功能描述

允许用户配置 AI 模型提供商：

| 提供商类型 | 配置项 |
|-----------|--------|
| Anthropic | API Key (可选，使用环境变量) + 模型选择 |
| OpenAI | API Key (可选，使用环境变量) + 模型选择 |
| 自定义 (OpenAI 兼容) | API Key + Base URL + 模型名称 |

### 3.2 支持的内置模型

```typescript
const BUILTIN_MODELS = {
  anthropic: [
    { id: 'claude-sonnet-4-20250514', name: 'Claude Sonnet 4' },
    { id: 'claude-3-5-haiku-20241022', name: 'Claude 3.5 Haiku' },
  ],
  openai: [
    { id: 'gpt-4o', name: 'GPT-4o' },
    { id: 'gpt-4o-mini', name: 'GPT-4o Mini' },
  ],
};
```

### 3.3 自定义提供商支持

已测试支持：
- 火山引擎 (Volcengine) Coding Plan
  - Base URL: `https://ark.cn-beijing.volces.com/api/coding/v3`
  - Model: `ark-code-latest`

### 3.4 技术细节

**问题**: Vercel AI SDK 默认使用 `/responses` 端点（OpenAI 新 API），但大多数 OpenAI 兼容服务（如火山引擎）只支持 `/chat/completions` 端点。

**解决方案**: 测试连接功能使用自定义 HTTP 请求直接调用 `/chat/completions`：

```typescript
async function testCustomProvider(baseUrl: string, apiKey: string, model: string) {
  const url = `${baseUrl.replace(/\/$/, '')}/chat/completions`;
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages: [{ role: 'user', content: 'Say OK' }],
      max_tokens: 10,
    }),
  });
  // ...
}
```

### 3.5 相关文件

```
lib/types.ts                     # ProviderSettings, AppSettings 类型
stores/app-store.ts              # useSettingsStore (localStorage 持久化)
lib/fs/index.ts                  # SETTINGS_FILE 常量
app/api/settings/route.ts        # GET/PUT 设置 API
app/api/settings/test/route.ts   # 测试连接 API
lib/ai/config.ts                 # 动态模型创建
app/(main)/settings/page.tsx     # 设置页面 UI
components/layout/sidebar.tsx    # 添加 Settings 导航链接
```

---

## 四、技术栈最终确认

| 层级 | 技术选择 |
|------|----------|
| 框架 | Next.js 16 (App Router) |
| 语言 | TypeScript |
| UI 组件 | shadcn/ui + Tailwind CSS |
| AI 集成 | Vercel AI SDK (ToolLoopAgent) |
| 数据存储 | 本地文件系统 (JSON + Markdown) |
| 状态管理 | Zustand (with localStorage persist) |
| 部署 | 本地开发 / Vercel |

---

## 五、待解决问题

### 5.1 主聊天功能的自定义提供商支持

**问题**: `lib/ai/config.ts` 中的 `getModel()` 使用 Vercel AI SDK 的 `createOpenAI`，同样会调用 `/responses` 端点。

**需要**: 为自定义提供商实现类似测试 API 的直接 HTTP 调用，或找到 SDK 配置方式强制使用 `/chat/completions`。

### 5.2 火山引擎集成完整性

已完成：
- [x] 测试连接功能
- [ ] 主聊天功能（需要修改 `lib/ai/config.ts` 或 `app/api/chat/route.ts`）

---

## 六、GitHub 仓库

**地址**: https://github.com/FakeHank/PM-cowork

**首次提交内容**:
- 62 个文件
- PMWork MVP 完整功能
- 文件存储系统、文件夹选择器、全局收件箱、工作区聊天、设置页面

---

## 七、下一步计划

1. 修复自定义提供商的主聊天功能
2. 完善 Workspace 对话体验
3. 实现 Canvas 原型生成功能
4. 添加 Version 继承功能
