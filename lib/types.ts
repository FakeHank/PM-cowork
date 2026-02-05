// ============================================
// PMWork Core Types
// ============================================

// === Inbox ===
export interface InboxItem {
  id: string;
  content: string;
  contentType: 'text' | 'file' | 'image' | 'audio' | 'link';
  metadata: Record<string, unknown>;
  aiSummary?: string;
  aiTags: string[];
  linkedVersionId?: string;
  createdAt: Date;
  updatedAt: Date;
}

// === Project ===
export interface Project {
  id: string;
  name: string;
  description?: string;
  context?: string;
  createdAt: Date;
  updatedAt: Date;
}

// === Version ===
export interface Version {
  id: string;
  projectId: string;
  name: string;
  status: 'active' | 'done';
  parentVersionId?: string;
  aiSummary?: string;
  createdAt: Date;
  updatedAt: Date;
}

// === Spec Section (Structured spec.md) ===
export interface SpecSection {
  id: string;
  versionId: string;
  parentId?: string;
  orderIndex: number;
  title: string;
  content: string;
  status: 'draft' | 'todo' | 'done';
  createdAt: Date;
  updatedAt: Date;
}

// Spec outline for Agent context (lightweight)
export interface SpecOutlineItem {
  id: string;
  parentId?: string;
  title: string;
  status: 'draft' | 'todo' | 'done';
  depth: number;
}

// === Session & Message ===
export interface Session {
  id: string;
  versionId: string;
  title?: string;
  summary?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface Message {
  id: string;
  sessionId: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  metadata: MessageMetadata;
  createdAt: Date;
}

export interface MessageMetadata {
  toolCalls?: ToolCallRecord[];
  pendingChanges?: PendingChange[];
}

export interface ToolCallRecord {
  toolName: string;
  args: Record<string, unknown>;
  result?: unknown;
  status: 'pending' | 'completed' | 'failed';
}

// === Pending Changes (for user confirmation) ===
export interface PendingChange {
  id: string;
  sessionId: string;
  messageId: string;
  toolName: string;
  args: Record<string, unknown>;
  diff?: string;
  reason: string;
  status: 'pending' | 'confirmed' | 'rejected';
  createdAt: Date;
}

// === Decisions & Constraints (Agent Memory) ===
export interface Decision {
  id: string;
  versionId: string;
  sessionId?: string;
  decision: string;
  context?: string;
  alternatives?: string[];
  createdAt: Date;
}

export interface Constraint {
  id: string;
  versionId: string;
  constraintType: 'technical' | 'business' | 'design';
  description: string;
  source?: string;
  createdAt: Date;
}

// === Asset ===
export interface Asset {
  id: string;
  versionId: string;
  name: string;
  filePath: string;
  fileType: string;
  fileSize?: number;
  aiDescription?: string;
  createdAt: Date;
}

// === Reference ===
export interface Reference {
  id: string;
  versionId: string;
  sourceType: 'prev_spec' | 'inbox' | 'external';
  sourceId?: string;
  content: string;
  metadata: Record<string, unknown>;
  createdAt: Date;
}

// === Canvas ===
export interface Canvas {
  id: string;
  versionId: string;
  pages: CanvasPage[];
  generatedCode?: string;
  previewUrl?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface CanvasPage {
  id: string;
  name: string;
  description?: string;
  componentCode: string;
  states: CanvasPageState[];
}

export interface CanvasPageState {
  name: string;
  description: string;
  props?: Record<string, unknown>;
}

// === Agent Context ===
export interface AgentContext {
  project: Project;
  version: Version;
  specOutline: SpecOutlineItem[];
  recentDecisions: Decision[];
  constraints: Constraint[];
  lastSessionSummary?: string;
  pendingTodos: SpecOutlineItem[]; // sections with status='todo'
}

// === Settings ===
export type ProviderType = 'anthropic' | 'openai' | 'custom';

export interface ProviderSettings {
  provider: ProviderType;
  apiKey?: string;
  baseUrl?: string; // For custom OpenAI-compatible providers
  defaultModel: string;
  customModels?: string[]; // For custom provider model list
}

export interface AppSettings {
  provider: ProviderSettings;
  theme?: 'light' | 'dark' | 'system';
  markdown?: MarkdownSettings;
}

export type MarkdownPreviewStyle = 'elegant' | 'compact' | 'spacious';
export type MarkdownFontSize = 'sm' | 'md' | 'lg';

export interface MarkdownSettings {
  style: MarkdownPreviewStyle;
  fontSize: MarkdownFontSize;
}

export const DEFAULT_MARKDOWN_SETTINGS: MarkdownSettings = {
  style: 'elegant',
  fontSize: 'md',
};

// Default built-in models per provider
export const BUILTIN_MODELS = {
  anthropic: [
    { id: 'claude-sonnet-4-20250514', name: 'Claude Sonnet 4' },
    { id: 'claude-3-5-haiku-20241022', name: 'Claude 3.5 Haiku' },
  ],
  openai: [
    { id: 'gpt-4o', name: 'GPT-4o' },
    { id: 'gpt-4o-mini', name: 'GPT-4o Mini' },
  ],
} as const;

// === API Types ===
export interface ApiResponse<T> {
  data?: T;
  error?: string;
}

export interface PaginatedResponse<T> {
  data: T[];
  cursor?: string;
  hasMore: boolean;
}
