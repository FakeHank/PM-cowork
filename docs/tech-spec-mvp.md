# PMWork MVP — 技术实现文档

> 版本：v0.2 Draft
> 日期：2026-02-04
> 基于 PRD v0.1

---

## 一、技术选型总览

### 1.1 核心技术栈

| 层级 | 技术选择 | 理由 |
|------|----------|------|
| **框架** | Next.js 15 (App Router) | 全栈框架，前后端一体，部署简单 |
| **语言** | TypeScript | 类型安全，AI 辅助编码友好 |
| **UI 组件** | shadcn/ui + Tailwind CSS | 复制粘贴即用，高度可定制 |
| **AI 集成** | Vercel AI SDK (ToolLoopAgent) | **内置 Agent 循环**，多步骤工具调用，streaming |
| **数据库** | Supabase (PostgreSQL) | 免费 tier，实时订阅 |
| **文件存储** | Supabase Storage | 与数据库同一平台，简化管理 |
| **部署** | Vercel | 一键部署，自动 CI/CD |

### 1.2 关键架构决策

| 决策 | 选择 | 理由 |
|------|------|------|
| **Agent 架构** | Vercel AI SDK ToolLoopAgent | 内置多步骤循环，无需重型框架 |
| **认证** | 暂不实现 | MVP 阶段简化，后续加入 |
| **Canvas 输出** | React 组件 | 比纯 HTML 更灵活 |
| **spec 编辑** | 仅通过对话 | 保持 AI 上下文完整性 |

### 1.3 开发工具

| 工具 | 用途 |
|------|------|
| pnpm | 包管理器 |
| Drizzle ORM | 数据库 ORM（轻量、类型安全） |
| Zod | Schema 验证 |
| OpenCode | AI 辅助开发 |

---

## 二、Agent 架构（核心）

### 2.1 设计理念

PMWork 的核心是一个**现代化的 AI Agent**，不是简单的对话机器人。Agent 需要：

1. **深度理解上下文** — 项目历史、前序版本、spec 结构
2. **使用工具执行任务** — 更新 spec、搜索 Inbox、生成原型
3. **多步骤推理** — 分析用户反馈 → 找到相关 spec 章节 → 更新内容
4. **主动建议** — 发现遗漏、检查一致性

### 2.2 Agent 运行时架构

```
用户输入
    │
    ▼
┌─────────────────────────────────────────────────────────────┐
│                    PMWork Agent Runtime                      │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐  │
│  │   Planner   │  │   Writer    │  │     Reviewer        │  │
│  │  (规划步骤)  │──▶│  (执行工具) │──▶│  (验证结果)         │  │
│  └─────────────┘  └─────────────┘  └─────────────────────┘  │
│         │                │                    │              │
│         └────────────────┴────────────────────┘              │
│                          │                                   │
│                    ┌─────▼─────┐                            │
│                    │   Tools   │                            │
│                    └───────────┘                            │
└─────────────────────────────────────────────────────────────┘
    │
    ▼
┌─────────────────────────────────────────────────────────────┐
│                     Durable Memory (DB)                      │
│  • spec_sections (结构化章节)                                │
│  • decisions (历史决策)                                      │
│  • citations (引用溯源)                                      │
│  • constraints (已知约束)                                    │
└─────────────────────────────────────────────────────────────┘
```

### 2.3 使用 Vercel AI SDK ToolLoopAgent

```typescript
// lib/ai/agents/workspace-agent.ts
import { ToolLoopAgent, tool, stepCountIs } from 'ai';
import { anthropic } from '@ai-sdk/anthropic';
import { z } from 'zod';

// Workspace Agent - 文档写作专家
export const workspaceAgent = new ToolLoopAgent({
  model: anthropic('claude-3-5-sonnet-20241022'),
  instructions: workspaceSystemPrompt,
  tools: {
    // === Spec 操作工具 ===
    getSpecOutline: tool({
      description: '获取 spec.md 的章节大纲',
      parameters: z.object({ versionId: z.string() }),
      execute: async ({ versionId }) => {
        return await db.getSpecOutline(versionId);
      },
    }),
    
    readSpecSection: tool({
      description: '读取 spec.md 的指定章节内容',
      parameters: z.object({
        versionId: z.string(),
        sectionId: z.string(),
      }),
      execute: async ({ versionId, sectionId }) => {
        return await db.getSpecSection(versionId, sectionId);
      },
    }),
    
    patchSpecSection: tool({
      description: '修改 spec.md 的指定章节（基于 diff）',
      parameters: z.object({
        versionId: z.string(),
        sectionId: z.string(),
        diff: z.string().describe('unified diff 格式的修改'),
        reason: z.string().describe('修改原因'),
      }),
      execute: async ({ versionId, sectionId, diff, reason }) => {
        // 返回 pending 状态，等待用户确认
        return { status: 'pending_confirmation', diff, reason };
      },
    }),
    
    createSpecSection: tool({
      description: '在 spec.md 中创建新章节',
      parameters: z.object({
        versionId: z.string(),
        parentSectionId: z.string().optional(),
        title: z.string(),
        content: z.string(),
      }),
      execute: async (params) => {
        return { status: 'pending_confirmation', ...params };
      },
    }),

    // === 搜索工具 ===
    searchInbox: tool({
      description: '从 Inbox 中搜索相关碎片信息',
      parameters: z.object({
        query: z.string(),
        limit: z.number().default(5),
      }),
      execute: async ({ query, limit }) => {
        return await db.searchInbox(query, limit);
      },
    }),
    
    searchReferences: tool({
      description: '从 References 中搜索相关内容',
      parameters: z.object({
        versionId: z.string(),
        query: z.string(),
      }),
      execute: async ({ versionId, query }) => {
        return await db.searchReferences(versionId, query);
      },
    }),

    // === 验证工具 ===
    checkSpecCompleteness: tool({
      description: '检查 spec.md 的完整性（缺失章节、TODO 等）',
      parameters: z.object({ versionId: z.string() }),
      execute: async ({ versionId }) => {
        return await validator.checkCompleteness(versionId);
      },
    }),
    
    checkSpecConsistency: tool({
      description: '检查 spec.md 的一致性（术语、角色、状态等）',
      parameters: z.object({ versionId: z.string() }),
      execute: async ({ versionId }) => {
        return await validator.checkConsistency(versionId);
      },
    }),

    // === 记忆工具 ===
    recordDecision: tool({
      description: '记录一个产品决策（便于后续追溯）',
      parameters: z.object({
        versionId: z.string(),
        decision: z.string(),
        context: z.string(),
        alternatives: z.array(z.string()).optional(),
      }),
      execute: async (params) => {
        return await db.recordDecision(params);
      },
    }),
  },
  
  // 最多执行 15 步
  stopWhen: stepCountIs(15),
});
```

### 2.4 多角色设计（内部角色，非并发 Agent）

MVP 阶段，"多 Agent"实现为**同一 Agent 的不同调用模式**：

| 角色 | 触发时机 | System Prompt 变体 |
|------|----------|-------------------|
| **Planner** | 用户提出复杂任务 | 强调分解步骤、不立即执行 |
| **Writer** | 执行具体修改 | 强调使用工具、基于 diff |
| **Reviewer** | 每次修改后自动触发 | 强调检查完整性、一致性 |

```typescript
// 示例：复杂任务的处理流程
async function handleComplexTask(userMessage: string, versionId: string) {
  // 1. Planner 角色：分析任务，生成计划
  const plan = await workspaceAgent.generate({
    prompt: `[PLANNER MODE]\n${userMessage}`,
    // 只允许使用分析工具，不允许修改
    tools: { getSpecOutline, searchInbox, searchReferences },
  });
  
  // 2. 用户确认计划
  const confirmed = await waitForUserConfirmation(plan);
  if (!confirmed) return;
  
  // 3. Writer 角色：执行修改
  const result = await workspaceAgent.generate({
    prompt: `[WRITER MODE] 执行计划：${plan.text}`,
    tools: { ...allTools },
  });
  
  // 4. Reviewer 角色：验证结果
  const review = await workspaceAgent.generate({
    prompt: `[REVIEWER MODE] 检查刚才的修改是否正确`,
    tools: { checkSpecCompleteness, checkSpecConsistency },
  });
  
  return { plan, result, review };
}
```

### 2.5 持久化记忆（Durable Memory）

**关键原则：状态存在数据库，不是 prompt。**

```typescript
// 加载 Agent 上下文时，从数据库获取结构化信息
async function loadAgentContext(versionId: string): Promise<AgentContext> {
  return {
    // spec 结构（章节 ID + 标题，非全文）
    specOutline: await db.getSpecOutline(versionId),
    
    // 最近的决策记录
    recentDecisions: await db.getRecentDecisions(versionId, 5),
    
    // 已知约束
    constraints: await db.getConstraints(versionId),
    
    // 上次对话摘要（而非全部历史）
    lastSessionSummary: await db.getLastSessionSummary(versionId),
    
    // 当前待处理事项
    pendingTodos: await db.getPendingTodos(versionId),
  };
}
```

### 2.6 工具调用安全

| 工具类型 | 风险等级 | 处理方式 |
|----------|----------|----------|
| **读取类** (getSpecOutline, search*) | 低 | 自动执行 |
| **修改类** (patchSpecSection, create*) | 高 | 返回 diff，**用户确认后执行** |
| **记录类** (recordDecision) | 低 | 自动执行 |

```typescript
// 修改类工具返回 pending 状态，前端展示 diff 供用户确认
interface PendingChange {
  status: 'pending_confirmation';
  toolName: string;
  diff: string;
  reason: string;
}

// 用户确认后，调用实际执行
async function confirmChange(changeId: string) {
  const change = await db.getPendingChange(changeId);
  await db.applySpecChange(change);
  await db.markChangeApplied(changeId);
}
```

---

## 三、系统架构

### 3.1 整体架构

```
┌─────────────────────────────────────────────────────────────┐
│                        用户浏览器                           │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                     Next.js 应用                            │
│  ┌─────────────────────────────────────────────────────┐   │
│  │                   前端 (React)                       │   │
│  │  ┌─────────┐  ┌───────────┐  ┌─────────────────┐   │   │
│  │  │  Inbox  │  │ Workspace │  │     Canvas      │   │   │
│  │  └─────────┘  └───────────┘  └─────────────────┘   │   │
│  └─────────────────────────────────────────────────────┘   │
│                              │                              │
│  ┌─────────────────────────────────────────────────────┐   │
│  │              API Routes (后端逻辑)                   │   │
│  │  /api/inbox/*  /api/workspace/*  /api/canvas/*     │   │
│  │                    /api/chat/*                       │   │
│  └─────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
          │                    │                    │
          ▼                    ▼                    ▼
┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐
│    Supabase     │  │   AI Provider   │  │ Supabase Storage│
│   (PostgreSQL)  │  │ (Claude/GPT/...)│  │    (文件存储)   │
└─────────────────┘  └─────────────────┘  └─────────────────┘
```

### 3.2 目录结构

```
pmwork/
├── app/                          # Next.js App Router
│   ├── (auth)/                   # 认证相关页面
│   │   ├── login/
│   │   └── register/
│   ├── (main)/                   # 主应用布局
│   │   ├── layout.tsx            # 三栏布局
│   │   ├── inbox/                # Inbox 模块
│   │   │   └── page.tsx
│   │   ├── workspace/            # Workspace 模块
│   │   │   ├── page.tsx          # Project 列表
│   │   │   └── [projectId]/
│   │   │       └── [versionId]/
│   │   │           └── page.tsx  # Version 工作区
│   │   └── canvas/               # Canvas 模块
│   │       └── [canvasId]/
│   │           └── page.tsx
│   ├── api/                      # API Routes
│   │   ├── inbox/
│   │   ├── workspace/
│   │   ├── canvas/
│   │   └── chat/                 # AI 对话
│   └── layout.tsx                # 根布局
├── components/                   # 共享组件
│   ├── ui/                       # shadcn/ui 组件
│   ├── inbox/                    # Inbox 专用组件
│   ├── workspace/                # Workspace 专用组件
│   ├── canvas/                   # Canvas 专用组件
│   └── chat/                     # 对话相关组件
├── lib/                          # 工具库
│   ├── supabase/                 # Supabase 客户端
│   ├── ai/                       # AI 相关封装
│   ├── utils.ts
│   └── types.ts                  # 全局类型定义
├── hooks/                        # 自定义 Hooks
├── stores/                       # 状态管理 (Zustand)
└── prisma/                       # 数据库 Schema（如使用 Prisma）
    └── schema.prisma
```

---

## 四、数据模型

### 4.1 核心实体关系

```
InboxItem (N)
     │
Project (N)
     │
     └── Version (1:N)
          │
          ├── SpecSection (1:N)     ← 结构化章节（新增）
          │
          ├── Session (1:N) ─── Message (1:N)
          │
          ├── Decision (1:N)        ← 决策记录（新增）
          │
          ├── Asset (1:N)
          │
          ├── Reference (1:N)
          │
          └── Canvas (1:1)
```

### 4.2 数据库 Schema

```sql
-- ============================================
-- MVP 阶段暂不实现认证，所有数据共享
-- ============================================

-- Inbox 碎片
CREATE TABLE inbox_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  content TEXT NOT NULL,                    -- 主体内容
  content_type TEXT NOT NULL,               -- text, file, image, audio, link
  metadata JSONB DEFAULT '{}',              -- 原始文件信息、URL 等
  ai_summary TEXT,                          -- AI 生成的摘要
  ai_tags TEXT[] DEFAULT '{}',              -- AI 自动标签
  linked_version_id UUID,                   -- 关联的 Version（可空）
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Project
CREATE TABLE projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  context TEXT,                             -- Project 级别的背景信息
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Version
CREATE TABLE versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  name TEXT NOT NULL,                       -- e.g., "v1.0", "v2.1"
  status TEXT NOT NULL DEFAULT 'active',    -- active, done
  parent_version_id UUID REFERENCES versions(id), -- 继承的父版本
  ai_summary TEXT,                          -- AI 生成的版本摘要
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- spec.md 结构化存储（关键！支持 Agent 操作）
-- ============================================

-- Spec 章节（结构化存储，而非纯文本）
CREATE TABLE spec_sections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  version_id UUID NOT NULL REFERENCES versions(id) ON DELETE CASCADE,
  parent_id UUID REFERENCES spec_sections(id),  -- 父章节（支持嵌套）
  order_index INTEGER NOT NULL DEFAULT 0,       -- 排序
  title TEXT NOT NULL,                          -- 章节标题
  content TEXT DEFAULT '',                      -- 章节内容（Markdown）
  status TEXT DEFAULT 'draft',                  -- draft, todo, done
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 决策记录（Agent 记忆）
CREATE TABLE decisions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  version_id UUID NOT NULL REFERENCES versions(id) ON DELETE CASCADE,
  session_id UUID,                              -- 产生决策的会话
  decision TEXT NOT NULL,                       -- 决策内容
  context TEXT,                                 -- 决策背景
  alternatives JSONB DEFAULT '[]',              -- 考虑过的替代方案
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 约束记录（Agent 记忆）
CREATE TABLE constraints (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  version_id UUID NOT NULL REFERENCES versions(id) ON DELETE CASCADE,
  constraint_type TEXT NOT NULL,                -- technical, business, design
  description TEXT NOT NULL,
  source TEXT,                                  -- 约束来源
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Session（对话会话）
CREATE TABLE sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  version_id UUID NOT NULL REFERENCES versions(id) ON DELETE CASCADE,
  title TEXT,
  summary TEXT,                             -- AI 生成的会话摘要
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Message（对话消息）
CREATE TABLE messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  role TEXT NOT NULL,                       -- user, assistant, system
  content TEXT NOT NULL,
  metadata JSONB DEFAULT '{}',              -- 工具调用、spec 更新记录等
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Asset（素材）
CREATE TABLE assets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  version_id UUID NOT NULL REFERENCES versions(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  file_path TEXT NOT NULL,                  -- Supabase Storage 路径
  file_type TEXT NOT NULL,
  file_size INTEGER,
  ai_description TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Reference（引用）
CREATE TABLE references (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  version_id UUID NOT NULL REFERENCES versions(id) ON DELETE CASCADE,
  source_type TEXT NOT NULL,                -- prev_spec, inbox, external
  source_id UUID,                           -- 来源 ID（可空）
  content TEXT NOT NULL,                    -- 引用的内容
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Canvas（原型）
CREATE TABLE canvases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  version_id UUID NOT NULL REFERENCES versions(id) ON DELETE CASCADE,
  pages JSONB DEFAULT '[]',                 -- 页面列表和结构
  generated_code TEXT,                      -- AI 生成的代码
  preview_url TEXT,                         -- 预览 URL（如有）
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- spec.md 变更历史
CREATE TABLE spec_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  version_id UUID NOT NULL REFERENCES versions(id) ON DELETE CASCADE,
  session_id UUID REFERENCES sessions(id),  -- 触发变更的会话
  message_id UUID REFERENCES messages(id),  -- 触发变更的消息
  diff TEXT NOT NULL,                       -- 变更内容（diff 格式）
  description TEXT,                         -- 变更描述
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 索引
CREATE INDEX idx_inbox_items_user ON inbox_items(user_id);
CREATE INDEX idx_inbox_items_created ON inbox_items(created_at DESC);
CREATE INDEX idx_projects_user ON projects(user_id);
CREATE INDEX idx_versions_project ON versions(project_id);
CREATE INDEX idx_sessions_version ON sessions(version_id);
CREATE INDEX idx_messages_session ON messages(session_id);
```

---

## 五、模块实现方案

### 5.1 Inbox 模块

#### 5.1.1 MVP 范围 (P0)

| 功能 | 实现方式 |
|------|----------|
| 文字输入 | 富文本编辑器（Tiptap） |
| 文件拖入 | react-dropzone + Supabase Storage |
| 时间流展示 | 无限滚动列表（react-virtual） |
| 全文搜索 | Supabase Full-Text Search |
| 卡片展示 | 自定义卡片组件 |

#### 5.1.2 API 设计

```typescript
// GET /api/inbox
// 获取 Inbox 列表
interface GetInboxParams {
  cursor?: string;
  limit?: number;
  search?: string;
  tags?: string[];
}

// POST /api/inbox
// 创建 Inbox 项
interface CreateInboxParams {
  content: string;
  contentType: 'text' | 'file' | 'image' | 'audio' | 'link';
  metadata?: Record<string, any>;
}

// POST /api/inbox/[id]/send-to-workspace
// 发送到 Workspace
interface SendToWorkspaceParams {
  versionId: string;
}
```

#### 5.1.3 组件结构

```
components/inbox/
├── InboxTimeline.tsx        # 时间流容器
├── InboxCard.tsx            # 单个碎片卡片
├── InboxInput.tsx           # 输入区域
├── InboxSearch.tsx          # 搜索栏
└── InboxFilters.tsx         # 筛选器
```

---

### 5.2 Workspace 模块

#### 5.2.1 MVP 范围 (P0)

| 功能 | 实现方式 |
|------|----------|
| Project CRUD | 标准 CRUD API |
| Version CRUD | 标准 CRUD API |
| **Agent 对话** | Vercel AI SDK ToolLoopAgent |
| spec 结构化展示 | 基于 spec_sections 表渲染 |
| spec 更新 | **Agent 工具调用 + 用户确认** |
| 上下文感知 | Agent Context 从 DB 加载 |
| Session 保存 | 自动保存到数据库 |

#### 5.2.2 Agent 对话流程

```
用户输入
    │
    ▼
┌─────────────────────────────────────────────┐
│  1. 加载 Agent Context（从 DB）              │
│  • spec 大纲（章节 ID + 标题）                │
│  • 最近决策记录                               │
│  • 已知约束                                   │
│  • 上次会话摘要                               │
└─────────────────────────────────────────────┘
    │
    ▼
┌─────────────────────────────────────────────┐
│  2. Agent 多步推理（ToolLoopAgent）          │
│  • 自动规划执行步骤                           │
│  • 调用工具（搜索、读取、修改）               │
│  • 最多 15 步                                │
└─────────────────────────────────────────────┘
    │
    ▼
┌─────────────────────────────────────────────┐
│  3. 处理工具调用结果                          │
│  • 读取类 → 自动执行，结果返回给 Agent        │
│  • 修改类 → 生成 diff，等待用户确认           │
└─────────────────────────────────────────────┘
    │
    ▼
┌─────────────────────────────────────────────┐
│  4. 用户确认修改                              │
│  • 展示 diff 预览                            │
│  • 确认 → 应用修改，记录历史                  │
│  • 拒绝 → Agent 收到反馈，重新思考            │
└─────────────────────────────────────────────┘
```

#### 5.2.3 spec.md 结构化设计

**关键决策：spec 按章节存储在数据库，而非单个文本字段。**

```typescript
// spec_sections 表结构
interface SpecSection {
  id: string;
  versionId: string;
  parentId: string | null;  // 支持嵌套
  orderIndex: number;
  title: string;            // 如 "用户故事"
  content: string;          // Markdown 内容
  status: 'draft' | 'todo' | 'done';
}

// 渲染为 Markdown
function renderSpecToMarkdown(sections: SpecSection[]): string {
  // 递归渲染章节树
}

// 从 Markdown 解析为结构化数据（导入时）
function parseMarkdownToSections(markdown: string): SpecSection[] {
  // 解析标题层级，生成结构
}
```

**好处：**
- Agent 可以精确操作某个章节（通过 sectionId）
- 支持章节级别的状态跟踪（draft/todo/done）
- diff 更精准，用户确认更清晰
- 未来支持章节级别的协作

#### 5.2.4 API 设计

```typescript
// Projects
// GET    /api/projects
// POST   /api/projects
// GET    /api/projects/[id]
// PATCH  /api/projects/[id]
// DELETE /api/projects/[id]

// Versions
// GET    /api/projects/[projectId]/versions
// POST   /api/projects/[projectId]/versions
// GET    /api/versions/[id]
// DELETE /api/versions/[id]

// Spec Sections
// GET    /api/versions/[versionId]/spec          -- 获取完整 spec（结构化）
// GET    /api/versions/[versionId]/spec/outline  -- 获取大纲
// GET    /api/spec-sections/[id]                 -- 获取单个章节
// PATCH  /api/spec-sections/[id]                 -- 更新章节

// Agent Chat
// POST   /api/chat
interface ChatParams {
  versionId: string;
  sessionId?: string;  // 不传则创建新 Session
  message: string;
}

// 返回 Server-Sent Events 流
// 包含：text chunks, tool calls, pending changes

// Confirm Change
// POST   /api/changes/[changeId]/confirm
// POST   /api/changes/[changeId]/reject
```

#### 4.2.5 组件结构

```
components/workspace/
├── ProjectList.tsx          # Project 列表
├── VersionList.tsx          # Version 列表
├── WorkspaceLayout.tsx      # 工作区布局
├── ChatPanel.tsx            # 对话面板
├── SpecViewer.tsx           # spec.md 只读预览
├── SpecDiff.tsx             # spec 变更 diff 展示
├── FileExplorer.tsx         # 右侧文件浏览器
└── ContextSummary.tsx       # 上下文摘要展示
```

---

### 5.3 Canvas 模块

#### 5.3.1 MVP 范围 (P0)

| 功能 | 实现方式 |
|------|----------|
| 从 spec 生成原型 | AI 生成 React 代码 |
| iframe 预览 | 沙箱化 iframe |
| 对话迭代 | 与 Workspace 类似的对话机制 |
| 代码展示 | Monaco Editor (只读) |

#### 5.3.2 原型生成流程

```
用户点击"创建原型"
        │
        ▼
┌──────────────────────────────────────────┐
│  读取 spec.md                             │
│  提取：功能描述、用户故事、信息架构        │
└──────────────────────────────────────────┘
        │
        ▼
┌──────────────────────────────────────────┐
│  调用 AI 生成代码                          │
│  System Prompt:                           │
│  • 使用 React + Tailwind                  │
│  • Wireframe 风格（灰度 + 强调色）         │
│  • 输出单个 HTML 文件（内联 CSS/JS）       │
└──────────────────────────────────────────┘
        │
        ▼
┌──────────────────────────────────────────┐
│  保存生成的代码                            │
│  渲染到 iframe 中                          │
└──────────────────────────────────────────┘
```

#### 5.3.3 React 组件生成方案

```typescript
// Canvas Agent - 原型生成专家
export const canvasAgent = new ToolLoopAgent({
  model: anthropic('claude-3-5-sonnet-20241022'),
  instructions: canvasSystemPrompt,
  tools: {
    readSpec: tool({
      description: '读取 spec.md 内容',
      parameters: z.object({ versionId: z.string() }),
      execute: async ({ versionId }) => {
        return await db.getFullSpec(versionId);
      },
    }),
    
    generateComponent: tool({
      description: '生成 React 组件代码',
      parameters: z.object({
        componentName: z.string(),
        description: z.string(),
        props: z.array(z.object({
          name: z.string(),
          type: z.string(),
          description: z.string(),
        })).optional(),
      }),
      execute: async (params) => {
        // 返回生成请求，实际生成在下一步
        return { status: 'generate', ...params };
      },
    }),
  },
  stopWhen: stepCountIs(10),
});

// 生成的代码结构
interface GeneratedPrototype {
  // 主应用组件
  appCode: string;
  // 子组件
  components: Array<{
    name: string;
    code: string;
  }>;
  // 页面状态（正常/空态/错误态）
  states: Array<{
    name: string;
    description: string;
  }>;
}
```

#### 5.3.4 iframe 沙箱渲染

```typescript
// 将 React 组件渲染到 iframe
const generateHtmlTemplate = (prototype: GeneratedPrototype) => `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <script src="https://unpkg.com/react@18/umd/react.development.js"></script>
  <script src="https://unpkg.com/react-dom@18/umd/react-dom.development.js"></script>
  <script src="https://unpkg.com/@babel/standalone/babel.min.js"></script>
  <script src="https://cdn.tailwindcss.com"></script>
  <script>
    // 配置 Tailwind 为 wireframe 风格
    tailwind.config = {
      theme: {
        extend: {
          colors: {
            primary: '#3b82f6',  // 唯一强调色
          }
        }
      }
    }
  </script>
  <style>
    * { font-family: system-ui, -apple-system, sans-serif; }
    body { background: #f5f5f5; margin: 0; padding: 16px; }
  </style>
</head>
<body>
  <div id="root"></div>
  <script type="text/babel">
    ${prototype.components.map(c => c.code).join('\n\n')}
    
    ${prototype.appCode}
    
    const root = ReactDOM.createRoot(document.getElementById('root'));
    root.render(<App />);
  </script>
</body>
</html>
`;

// iframe 组件
<iframe
  srcDoc={generateHtmlTemplate(prototype)}
  sandbox="allow-scripts allow-same-origin"
  className="w-full h-full border-0 rounded-lg bg-white"
/>
```

#### 5.3.5 组件结构

```
components/canvas/
├── CanvasLayout.tsx         # Canvas 布局
├── CanvasPreview.tsx        # iframe 预览区
├── CanvasChat.tsx           # 迭代对话
├── CanvasCodeView.tsx       # 代码查看（只读）
├── CanvasToolbar.tsx        # 工具栏（刷新、导出等）
└── CanvasStateSwitch.tsx    # 状态切换（正常/空态/错误态）
```

---

### 5.4 AI 集成（Agent 模式）

#### 5.4.1 Vercel AI SDK 配置

```typescript
// lib/ai/config.ts
import { anthropic } from '@ai-sdk/anthropic';
import { openai } from '@ai-sdk/openai';

// 默认使用 Claude 3.5 Sonnet（平衡能力和成本）
export const defaultModel = anthropic('claude-3-5-sonnet-20241022');

// 备选模型
export const models = {
  'claude-3-5-sonnet': anthropic('claude-3-5-sonnet-20241022'),
  'claude-3-opus': anthropic('claude-3-opus-20240229'),
  'gpt-4o': openai('gpt-4o'),
};
```

#### 5.4.2 Agent API Route

```typescript
// app/api/chat/route.ts
import { createAgentUIStreamResponse } from 'ai';
import { workspaceAgent } from '@/lib/ai/agents/workspace-agent';

export async function POST(req: Request) {
  const { messages, versionId, sessionId } = await req.json();
  
  // 1. 加载 Agent 上下文
  const context = await loadAgentContext(versionId);
  
  // 2. 动态注入上下文到 Agent
  const contextualAgent = workspaceAgent.withContext({
    instructions: buildSystemPrompt(context),
  });
  
  // 3. 创建或获取 Session
  const session = sessionId 
    ? await db.getSession(sessionId)
    : await db.createSession(versionId);
  
  // 4. 保存用户消息
  await db.saveMessage(session.id, 'user', messages[messages.length - 1].content);
  
  // 5. 返回 Agent UI Stream（支持工具调用 + streaming）
  return createAgentUIStreamResponse({
    agent: contextualAgent,
    messages,
    onStepFinish: async ({ toolCalls, text }) => {
      // 记录每个步骤
      if (toolCalls) {
        for (const call of toolCalls) {
          await db.saveToolCall(session.id, call);
        }
      }
    },
    onFinish: async ({ text }) => {
      // 保存最终响应
      await db.saveMessage(session.id, 'assistant', text);
    },
  });
}
```

#### 5.4.3 System Prompt 模板

```typescript
// lib/ai/prompts.ts
export const buildSystemPrompt = (context: AgentContext) => `
你是 PMWork 的 AI 助手，一个专业的产品文档写作专家。

## 核心职责
1. 帮助产品经理撰写和完善产品需求文档 (spec)
2. 主动使用工具搜索和引用已有信息
3. 发现文档中的遗漏、不一致、模糊之处
4. 记录重要的产品决策

## 当前项目
- 项目：${context.project.name}
- 版本：${context.version.name}
- 状态：${context.version.status}

## Spec 大纲
${context.specOutline.map(s => `- [${s.id}] ${s.title} (${s.status})`).join('\n')}

## 最近决策
${context.recentDecisions.map(d => `- ${d.decision}`).join('\n') || '暂无'}

## 已知约束
${context.constraints.map(c => `- [${c.type}] ${c.description}`).join('\n') || '暂无'}

## 工作原则
1. **先读后写**：修改前先用 readSpecSection 读取当前内容
2. **基于 diff**：使用 patchSpecSection 而非整体替换
3. **说明原因**：每次修改都要说明为什么
4. **等待确认**：修改类操作会返回 diff，等用户确认
5. **引用来源**：引用 Inbox 或 References 时标注来源
6. **记录决策**：重要决策使用 recordDecision 工具保存

## 注意事项
- 不要编造信息，不确定时使用搜索工具
- 如果用户想法有明显问题，委婉指出
- 复杂任务先分解步骤，逐步执行
`;
```

---

## 六、界面设计

### 6.1 三栏布局

```
┌─────────┬────────────────────────────────┬─────────────────────┐
│  200px  │           flex-1               │        300px        │
│         │                                │                     │
│  导航栏  │           主内容区              │      侧边栏         │
│         │                                │                     │
│ + New   │                                │  文件浏览器          │
│         │                                │  ├── spec.md        │
│ Inbox   │      （根据模块变化）            │  ├── sessions/      │
│         │                                │  ├── assets/        │
│Workspace│      Inbox: 时间流              │  └── references/    │
│ ├ Proj A│      Workspace: 对话           │                     │
│ └ Proj B│      Canvas: 预览              │  ─────────────────  │
│         │                                │                     │
│ Canvas  │                                │  文件预览            │
│         │                                │  （只读展示）        │
│ ─────── │                                │                     │
│ Recents │                                │                     │
│         │                                │                     │
└─────────┴────────────────────────────────┴─────────────────────┘
```

### 6.2 响应式设计

| 断点 | 布局调整 |
|------|----------|
| >= 1280px | 三栏完整展示 |
| 768px - 1279px | 左侧栏可收起，右侧栏改为抽屉 |
| < 768px | 单栏，底部导航 |

---

## 七、MVP 范围与优先级

### 7.1 P0（MVP 必须）

| 模块 | 功能 | 说明 |
|------|------|------|
| **Inbox** | 文字输入、时间流展示、搜索 | 最基础的碎片收集 |
| **Workspace** | Project/Version CRUD | 基础数据管理 |
| **Workspace** | **Agent 对话** | 核心功能：ToolLoopAgent + 工具调用 |
| **Workspace** | **结构化 spec** | 章节级别的读/写/更新 |
| **Workspace** | **修改确认流程** | diff 预览 + 用户确认 |
| **Canvas** | 从 spec 生成 React 原型 | AI 生成 + iframe 预览 |
| **Canvas** | 对话迭代 | 与 Workspace 类似的 Agent 模式 |

### 7.2 P1（MVP 之后）

| 模块 | 功能 |
|------|------|
| **Inbox** | 文件上传、图片识别、AI 标签 |
| **Workspace** | Version 继承、Session 摘要 |
| **Workspace** | 完整性/一致性检查（Reviewer 角色） |
| **Workspace** | 决策记录和追溯 |
| **Canvas** | 状态变体（空态/错误态/loading态） |
| **Canvas** | 导出功能（截图/代码） |
| **认证** | 用户登录、多用户隔离 |

### 7.3 P2（后续迭代）

| 模块 | 功能 |
|------|------|
| **Inbox** | 自然语言搜索、相关性聚类、Project 关联建议 |
| **Workspace** | 跨 Version 对比、知识图谱 |
| **Canvas** | 交互流程图、多页面管理、spec 同步 |
| **全局** | 多人协作、评审流程 |

---

## 八、开发计划

### 8.1 阶段划分

| 阶段 | 时长 | 目标 |
|------|------|------|
| **Phase 1** | 3-4 天 | 基础框架搭建、数据库、三栏布局 |
| **Phase 2** | 3-4 天 | Inbox 核心功能 |
| **Phase 3** | 1 周 | **Workspace Agent 核心**（重点） |
| **Phase 4** | 4-5 天 | Canvas 基础功能 |
| **Phase 5** | 3-4 天 | 联调、测试、修复 |

**总计约 4-5 周**

### 8.2 Phase 1 详细任务

- [ ] Next.js 15 项目初始化 (App Router)
- [ ] shadcn/ui 组件库配置
- [ ] Tailwind CSS 配置
- [ ] Supabase 项目创建
- [ ] 数据库 Schema 迁移（含 spec_sections）
- [ ] 三栏布局骨架组件
- [ ] Project/Version 基础 CRUD

### 8.3 Phase 3 详细任务（核心）

- [ ] Vercel AI SDK 集成
- [ ] ToolLoopAgent 配置
- [ ] 工具函数实现（读/写 spec、搜索等）
- [ ] Agent Context 加载逻辑
- [ ] Chat API Route (SSE streaming)
- [ ] 前端对话 UI（消息列表、输入框）
- [ ] 工具调用展示（思考过程）
- [ ] **Diff 预览组件**（关键）
- [ ] **修改确认流程**（关键）
- [ ] spec_sections 渲染组件

---

## 九、技术风险与缓解

| 风险 | 影响 | 缓解措施 |
|------|------|----------|
| AI 响应慢 | 用户体验差 | Streaming + 骨架屏 + 步骤进度展示 |
| Agent 步骤过多 | 超时/超预算 | `stopWhen: stepCountIs(15)` 硬性限制 |
| AI 生成代码无法渲染 | Canvas 功能失效 | 错误捕获 + 重试 + 降级提示 |
| spec 修改丢失 | 用户工作丢失 | 所有修改基于 diff，完整历史记录 |
| 上下文过长 | Token 超限 | 结构化存储，按需加载章节内容 |
| Supabase 免费额度 | 服务中断 | 监控用量，预留升级计划 |

---

## 十、已确认决策

| 决策项 | 决策 | 理由 |
|--------|------|------|
| Agent 架构 | Vercel AI SDK ToolLoopAgent | 内置多步骤循环，无需重型框架 |
| spec 编辑方式 | 仅通过对话 | 保持 AI 上下文完整性 |
| Canvas 输出 | React 组件 | 比纯 HTML 更灵活，支持组件复用 |
| 认证 | MVP 暂不实现 | 快速验证，后续加入 |

---

## 十一、待进一步设计

1. **spec 模板初始化**：创建新 Version 时，如何初始化 spec_sections？默认模板？用户选择？
2. **Agent 提示词调优**：需要迭代测试，优化工具调用的准确性
3. **Canvas 状态管理**：如何管理多个页面的不同状态（正常/空态/错误态）？
4. **错误恢复**：Agent 执行失败时的回滚机制

---

## 附录

### A. 参考资源

- [Next.js 15 文档](https://nextjs.org/docs)
- [Vercel AI SDK 文档](https://sdk.vercel.ai/docs)
- [Vercel AI SDK Agents](https://sdk.vercel.ai/docs/agents) — **重点阅读**
- [ToolLoopAgent API](https://sdk.vercel.ai/docs/reference/ai-sdk-core/tool-loop-agent)
- [shadcn/ui 组件](https://ui.shadcn.com/)
- [Supabase 文档](https://supabase.com/docs)
- [Drizzle ORM](https://orm.drizzle.team/)
- [Zod Schema 验证](https://zod.dev/)

### B. 相关设计参考

- v0.dev — AI 生成 React 组件的参考
- Claude Artifacts — 代码预览的交互模式参考

### C. 待补充

- UI/UX 原型图
- 详细的 API 文档
- 测试计划
