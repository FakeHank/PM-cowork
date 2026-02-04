-- ============================================
-- PMWork MVP Database Schema
-- Run this in Supabase SQL Editor
-- ============================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================
-- Core Tables
-- ============================================

-- Inbox Items (fragments/notes)
CREATE TABLE inbox_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  content TEXT NOT NULL,
  content_type TEXT NOT NULL CHECK (content_type IN ('text', 'file', 'image', 'audio', 'link')),
  metadata JSONB DEFAULT '{}',
  ai_summary TEXT,
  ai_tags TEXT[] DEFAULT '{}',
  linked_version_id UUID,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Projects
CREATE TABLE projects (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  description TEXT,
  context TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Versions (belong to Projects)
CREATE TABLE versions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'done')),
  parent_version_id UUID REFERENCES versions(id),
  ai_summary TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add foreign key for inbox_items -> versions
ALTER TABLE inbox_items 
  ADD CONSTRAINT fk_inbox_version 
  FOREIGN KEY (linked_version_id) 
  REFERENCES versions(id) ON DELETE SET NULL;

-- ============================================
-- Spec Structure (structured spec.md storage)
-- ============================================

-- Spec Sections (chapters of spec.md)
CREATE TABLE spec_sections (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  version_id UUID NOT NULL REFERENCES versions(id) ON DELETE CASCADE,
  parent_id UUID REFERENCES spec_sections(id) ON DELETE CASCADE,
  order_index INTEGER NOT NULL DEFAULT 0,
  title TEXT NOT NULL,
  content TEXT DEFAULT '',
  status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'todo', 'done')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- Agent Memory (decisions & constraints)
-- ============================================

-- Decisions (recorded by Agent)
CREATE TABLE decisions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  version_id UUID NOT NULL REFERENCES versions(id) ON DELETE CASCADE,
  session_id UUID,
  decision TEXT NOT NULL,
  context TEXT,
  alternatives JSONB DEFAULT '[]',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Constraints (known limitations)
CREATE TABLE constraints (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  version_id UUID NOT NULL REFERENCES versions(id) ON DELETE CASCADE,
  constraint_type TEXT NOT NULL CHECK (constraint_type IN ('technical', 'business', 'design')),
  description TEXT NOT NULL,
  source TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- Chat Sessions & Messages
-- ============================================

-- Sessions (conversation threads)
CREATE TABLE sessions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  version_id UUID NOT NULL REFERENCES versions(id) ON DELETE CASCADE,
  title TEXT,
  summary TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Update decisions table to reference sessions
ALTER TABLE decisions 
  ADD CONSTRAINT fk_decision_session 
  FOREIGN KEY (session_id) 
  REFERENCES sessions(id) ON DELETE SET NULL;

-- Messages (chat messages)
CREATE TABLE messages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  session_id UUID NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
  content TEXT NOT NULL,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Pending Changes (for user confirmation)
CREATE TABLE pending_changes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  session_id UUID NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  message_id UUID REFERENCES messages(id) ON DELETE CASCADE,
  tool_name TEXT NOT NULL,
  args JSONB NOT NULL DEFAULT '{}',
  diff TEXT,
  reason TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'confirmed', 'rejected')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- Assets & References
-- ============================================

-- Assets (uploaded files)
CREATE TABLE assets (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  version_id UUID NOT NULL REFERENCES versions(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  file_path TEXT NOT NULL,
  file_type TEXT NOT NULL,
  file_size INTEGER,
  ai_description TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- References (linked content)
CREATE TABLE references (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  version_id UUID NOT NULL REFERENCES versions(id) ON DELETE CASCADE,
  source_type TEXT NOT NULL CHECK (source_type IN ('prev_spec', 'inbox', 'external')),
  source_id UUID,
  content TEXT NOT NULL,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- Canvas (prototypes)
-- ============================================

CREATE TABLE canvases (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  version_id UUID NOT NULL REFERENCES versions(id) ON DELETE CASCADE,
  pages JSONB DEFAULT '[]',
  generated_code TEXT,
  preview_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- Spec History (change tracking)
-- ============================================

CREATE TABLE spec_history (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  version_id UUID NOT NULL REFERENCES versions(id) ON DELETE CASCADE,
  session_id UUID REFERENCES sessions(id) ON DELETE SET NULL,
  message_id UUID REFERENCES messages(id) ON DELETE SET NULL,
  section_id UUID REFERENCES spec_sections(id) ON DELETE SET NULL,
  diff TEXT NOT NULL,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- Indexes for Performance
-- ============================================

-- Inbox
CREATE INDEX idx_inbox_items_created ON inbox_items(created_at DESC);
CREATE INDEX idx_inbox_items_content_type ON inbox_items(content_type);
CREATE INDEX idx_inbox_items_linked_version ON inbox_items(linked_version_id);

-- Projects & Versions
CREATE INDEX idx_versions_project ON versions(project_id);
CREATE INDEX idx_versions_status ON versions(status);

-- Spec Sections
CREATE INDEX idx_spec_sections_version ON spec_sections(version_id);
CREATE INDEX idx_spec_sections_parent ON spec_sections(parent_id);
CREATE INDEX idx_spec_sections_order ON spec_sections(version_id, order_index);

-- Sessions & Messages
CREATE INDEX idx_sessions_version ON sessions(version_id);
CREATE INDEX idx_messages_session ON messages(session_id);
CREATE INDEX idx_messages_created ON messages(created_at);

-- Decisions & Constraints
CREATE INDEX idx_decisions_version ON decisions(version_id);
CREATE INDEX idx_constraints_version ON constraints(version_id);

-- Assets & References
CREATE INDEX idx_assets_version ON assets(version_id);
CREATE INDEX idx_references_version ON references(version_id);

-- Pending Changes
CREATE INDEX idx_pending_changes_session ON pending_changes(session_id);
CREATE INDEX idx_pending_changes_status ON pending_changes(status);

-- ============================================
-- Triggers for updated_at
-- ============================================

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_inbox_items_updated_at
    BEFORE UPDATE ON inbox_items
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_projects_updated_at
    BEFORE UPDATE ON projects
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_versions_updated_at
    BEFORE UPDATE ON versions
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_spec_sections_updated_at
    BEFORE UPDATE ON spec_sections
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_sessions_updated_at
    BEFORE UPDATE ON sessions
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_canvases_updated_at
    BEFORE UPDATE ON canvases
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- Full-Text Search for Inbox (optional)
-- ============================================

-- Add tsvector column for search
ALTER TABLE inbox_items ADD COLUMN search_vector tsvector;

-- Create function to update search vector
CREATE OR REPLACE FUNCTION inbox_search_trigger()
RETURNS TRIGGER AS $$
BEGIN
    NEW.search_vector := to_tsvector('english', COALESCE(NEW.content, '') || ' ' || COALESCE(NEW.ai_summary, ''));
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger
CREATE TRIGGER inbox_search_update
    BEFORE INSERT OR UPDATE ON inbox_items
    FOR EACH ROW
    EXECUTE FUNCTION inbox_search_trigger();

-- Create GIN index for fast search
CREATE INDEX idx_inbox_search ON inbox_items USING GIN(search_vector);

-- ============================================
-- Sample Data (for testing)
-- ============================================

-- Insert sample project
INSERT INTO projects (id, name, description, context) VALUES
  ('11111111-1111-1111-1111-111111111111', '搜索功能', '产品搜索功能的迭代开发', '电商平台核心功能之一'),
  ('22222222-2222-2222-2222-222222222222', '支付系统', '支付流程优化和新支付方式接入', '需要考虑安全性和合规性');

-- Insert sample versions
INSERT INTO versions (id, project_id, name, status) VALUES
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '11111111-1111-1111-1111-111111111111', 'v2.1', 'active'),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', '11111111-1111-1111-1111-111111111111', 'v2.0', 'done'),
  ('cccccccc-cccc-cccc-cccc-cccccccccccc', '22222222-2222-2222-2222-222222222222', 'v1.0', 'active');

-- Insert sample spec sections
INSERT INTO spec_sections (id, version_id, order_index, title, content, status) VALUES
  ('dddddddd-dddd-dddd-dddd-dddddddddddd', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 0, '背景与问题', '## 背景\n\n当前搜索功能存在以下问题：\n1. 搜索结果不够准确\n2. 搜索速度较慢', 'done'),
  ('eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 1, '目标与度量', '## 目标\n\n- 提升搜索准确率至 95%\n- 搜索响应时间 < 200ms', 'done'),
  ('ffffffff-ffff-ffff-ffff-ffffffffffff', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 2, '用户故事', '', 'todo'),
  ('00000000-0000-0000-0000-000000000001', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 3, '功能描述', '', 'todo');

-- Insert sample inbox items
INSERT INTO inbox_items (content, content_type, ai_tags) VALUES
  ('用户反馈：搜索结果排序不合理，最相关的商品不在前面', 'text', ARRAY['搜索', '用户反馈', '排序']),
  ('竞品分析：京东搜索支持按销量、价格、评分排序', 'text', ARRAY['竞品分析', '搜索', '排序']),
  ('产品想法：是否可以加入智能推荐，根据用户历史搜索推荐相关商品', 'text', ARRAY['产品想法', '推荐', '个性化']);

-- Insert sample session
INSERT INTO sessions (id, version_id, title) VALUES
  ('99999999-9999-9999-9999-999999999999', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Initial spec discussion');

-- Insert sample messages
INSERT INTO messages (session_id, role, content) VALUES
  ('99999999-9999-9999-9999-999999999999', 'assistant', '你好！我是 PMWork 的 AI 助手。我已经加载了当前版本的上下文。有什么我可以帮助你的吗？'),
  ('99999999-9999-9999-9999-999999999999', 'user', '我想添加一些用户故事'),
  ('99999999-9999-9999-9999-999999999999', 'assistant', '好的，让我先查看一下当前的 spec 结构和 Inbox 中的相关信息...');
