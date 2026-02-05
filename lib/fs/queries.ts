import path from 'path';
import {
  PROJECTS_ROOT,
  GLOBAL_INBOX_ROOT,
  ensureDir,
  exists,
  readJson,
  writeJson,
  readText,
  writeText,
  listDirs,
  listFiles,
  removeDir,
  removeFile,
  getStats,
  slugify,
  generateId,
} from './index';
import type {
  ProjectMeta,
  VersionMeta,
  SessionData,
  SessionMessage,
  InboxItemMeta,
} from './types';
import type {
  Project,
  Version,
  InboxItem,
  Session,
  Message,
  SpecSection,
  SpecOutlineItem,
  AgentContext,
  Decision,
  Constraint,
} from '@/lib/types';

function projectPath(projectName: string): string {
  return path.join(PROJECTS_ROOT, projectName);
}

function versionPath(projectName: string, versionName: string): string {
  return path.join(PROJECTS_ROOT, projectName, 'versions', versionName);
}

function toProject(meta: ProjectMeta, folderName: string): Project {
  return {
    id: folderName,
    name: meta.name,
    description: meta.description,
    createdAt: new Date(meta.createdAt),
    updatedAt: new Date(meta.updatedAt),
  };
}

function toVersion(meta: VersionMeta, projectId: string, folderName: string): Version {
  return {
    id: `${projectId}/${folderName}`,
    projectId,
    name: meta.name,
    status: meta.status,
    createdAt: new Date(meta.createdAt),
    updatedAt: new Date(meta.updatedAt),
  };
}

export async function initProjectsRoot(): Promise<void> {
  await ensureDir(PROJECTS_ROOT);
}

export async function getProjects(): Promise<Project[]> {
  await initProjectsRoot();
  const folders = await listDirs(PROJECTS_ROOT);
  const projects: Project[] = [];

  for (const folder of folders) {
    const metaPath = path.join(projectPath(folder), 'project.json');
    const meta = await readJson<ProjectMeta>(metaPath);
    if (meta) {
      projects.push(toProject(meta, folder));
    }
  }

  return projects.sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime());
}

export async function getProject(id: string): Promise<Project | null> {
  const metaPath = path.join(projectPath(id), 'project.json');
  const meta = await readJson<ProjectMeta>(metaPath);
  return meta ? toProject(meta, id) : null;
}

export async function createProject(input: { name: string; description?: string }): Promise<Project> {
  const now = new Date().toISOString();
  const folderName = slugify(input.name) || generateId();
  const projPath = projectPath(folderName);

  if (await exists(projPath)) {
    throw new Error(`Project folder "${folderName}" already exists`);
  }

  const meta: ProjectMeta = {
    id: folderName,
    name: input.name,
    description: input.description,
    createdAt: now,
    updatedAt: now,
  };

  await ensureDir(projPath);
  await ensureDir(path.join(projPath, 'inbox'));
  await ensureDir(path.join(projPath, 'versions'));
  await writeJson(path.join(projPath, 'project.json'), meta);

  return toProject(meta, folderName);
}

export async function updateProject(
  id: string,
  input: Partial<Pick<Project, 'name' | 'description'>>
): Promise<Project | null> {
  const metaPath = path.join(projectPath(id), 'project.json');
  const meta = await readJson<ProjectMeta>(metaPath);
  if (!meta) return null;

  const updated: ProjectMeta = {
    ...meta,
    ...input,
    updatedAt: new Date().toISOString(),
  };
  await writeJson(metaPath, updated);
  return toProject(updated, id);
}

export async function deleteProject(id: string): Promise<boolean> {
  return removeDir(projectPath(id));
}

export async function getVersionsByProject(projectId: string): Promise<Version[]> {
  const versionsDir = path.join(projectPath(projectId), 'versions');
  const folders = await listDirs(versionsDir);
  const versions: Version[] = [];

  for (const folder of folders) {
    const metaPath = path.join(versionsDir, folder, 'version.json');
    const meta = await readJson<VersionMeta>(metaPath);
    if (meta) {
      versions.push(toVersion(meta, projectId, folder));
    }
  }

  return versions.sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime());
}

export async function getVersion(id: string): Promise<Version | null> {
  const [projectId, versionFolder] = id.split('/');
  if (!projectId || !versionFolder) return null;

  const metaPath = path.join(versionPath(projectId, versionFolder), 'version.json');
  const meta = await readJson<VersionMeta>(metaPath);
  return meta ? toVersion(meta, projectId, versionFolder) : null;
}

export async function createVersion(input: {
  projectId: string;
  name: string;
}): Promise<Version> {
  const now = new Date().toISOString();
  const folderName = slugify(input.name) || generateId();
  const verPath = versionPath(input.projectId, folderName);

  if (await exists(verPath)) {
    throw new Error(`Version folder "${folderName}" already exists`);
  }

  const meta: VersionMeta = {
    id: folderName,
    name: input.name,
    status: 'active',
    createdAt: now,
    updatedAt: now,
  };

  await ensureDir(verPath);
  await ensureDir(path.join(verPath, 'sessions'));
  await ensureDir(path.join(verPath, 'assets'));
  await ensureDir(path.join(verPath, 'references'));
  await writeJson(path.join(verPath, 'version.json'), meta);
  await writeText(path.join(verPath, 'spec.md'), getDefaultSpecTemplate(input.name));

  return toVersion(meta, input.projectId, folderName);
}

export async function updateVersion(
  id: string,
  input: Partial<Pick<Version, 'name' | 'status'>>
): Promise<Version | null> {
  const [projectId, versionFolder] = id.split('/');
  if (!projectId || !versionFolder) return null;

  const metaPath = path.join(versionPath(projectId, versionFolder), 'version.json');
  const meta = await readJson<VersionMeta>(metaPath);
  if (!meta) return null;

  const updated: VersionMeta = {
    ...meta,
    ...input,
    updatedAt: new Date().toISOString(),
  };
  await writeJson(metaPath, updated);
  return toVersion(updated, projectId, versionFolder);
}

export async function deleteVersion(id: string): Promise<boolean> {
  const [projectId, versionFolder] = id.split('/');
  if (!projectId || !versionFolder) return false;
  return removeDir(versionPath(projectId, versionFolder));
}

export async function getSpec(versionId: string): Promise<string> {
  const [projectId, versionFolder] = versionId.split('/');
  if (!projectId || !versionFolder) return '';

  const specPath = path.join(versionPath(projectId, versionFolder), 'spec.md');
  return (await readText(specPath)) || '';
}

export async function updateSpec(versionId: string, content: string): Promise<boolean> {
  const [projectId, versionFolder] = versionId.split('/');
  if (!projectId || !versionFolder) return false;

  const specPath = path.join(versionPath(projectId, versionFolder), 'spec.md');
  await writeText(specPath, content);
  return true;
}

export async function getSpecOutline(versionId: string): Promise<SpecOutlineItem[]> {
  const content = await getSpec(versionId);
  if (!content) return [];

  const lines = content.split('\n');
  const outline: SpecOutlineItem[] = [];
  let currentId = 0;

  for (const line of lines) {
    const match = line.match(/^(#{1,6})\s+(.+)$/);
    if (match) {
      const depth = match[1].length - 1;
      const title = match[2].trim();
      outline.push({
        id: `h${++currentId}`,
        title,
        status: 'draft',
        depth,
      });
    }
  }

  return outline;
}

export async function getSpecSection(versionId: string, sectionId: string): Promise<SpecSection | null> {
  const content = await getSpec(versionId);
  if (!content) return null;

  const lines = content.split('\n');
  let currentId = 0;
  let capturing = false;
  let sectionTitle = '';
  let sectionContent: string[] = [];
  let sectionDepth = 0;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const match = line.match(/^(#{1,6})\s+(.+)$/);

    if (match) {
      const depth = match[1].length;
      const title = match[2].trim();
      currentId++;

      if (capturing) {
        if (depth <= sectionDepth) {
          break;
        }
        sectionContent.push(line);
      } else if (`h${currentId}` === sectionId) {
        capturing = true;
        sectionTitle = title;
        sectionDepth = depth;
      }
    } else if (capturing) {
      sectionContent.push(line);
    }
  }

  if (!sectionTitle) return null;

  return {
    id: sectionId,
    versionId,
    title: sectionTitle,
    content: sectionContent.join('\n').trim(),
    status: 'draft',
    orderIndex: parseInt(sectionId.slice(1)),
    createdAt: new Date(),
    updatedAt: new Date(),
  };
}

export async function getInboxItems(
  projectId: string,
  options?: { limit?: number; search?: string }
): Promise<{ items: InboxItem[]; nextCursor?: string }> {
  const inboxDir = path.join(projectPath(projectId), 'inbox');
  const files = await listFiles(inboxDir, '.md');
  let items: InboxItem[] = [];

  for (const file of files) {
    const filePath = path.join(inboxDir, file);
    const content = await readText(filePath);
    const stats = await getStats(filePath);
    if (content && stats) {
      const id = file.replace('.md', '');
      const lines = content.split('\n');
      const titleLine = lines[0] || '';
      const title = titleLine.startsWith('# ') ? titleLine.slice(2) : id;

      items.push({
        id,
        content,
        contentType: 'text',
        metadata: {},
        aiTags: [],
        createdAt: stats.mtime,
        updatedAt: stats.mtime,
      });
    }
  }

  if (options?.search) {
    const search = options.search.toLowerCase();
    items = items.filter((item) => item.content.toLowerCase().includes(search));
  }

  items.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

  const limit = options?.limit || 20;
  return { items: items.slice(0, limit) };
}

export async function getInboxItem(projectId: string, itemId: string): Promise<InboxItem | null> {
  const filePath = path.join(projectPath(projectId), 'inbox', `${itemId}.md`);
  const content = await readText(filePath);
  const stats = await getStats(filePath);

  if (!content || !stats) return null;

  return {
    id: itemId,
    content,
    contentType: 'text',
    metadata: {},
    aiTags: [],
    createdAt: stats.mtime,
    updatedAt: stats.mtime,
  };
}

export async function createInboxItem(
  projectId: string,
  input: { content: string; title?: string }
): Promise<InboxItem> {
  const now = new Date();
  const id = `${now.getTime()}-${slugify(input.title || 'note') || generateId()}`;
  const filePath = path.join(projectPath(projectId), 'inbox', `${id}.md`);

  let content = input.content;
  if (input.title && !content.startsWith('# ')) {
    content = `# ${input.title}\n\n${content}`;
  }

  await writeText(filePath, content);

  return {
    id,
    content,
    contentType: 'text',
    metadata: {},
    aiTags: [],
    createdAt: now,
    updatedAt: now,
  };
}

export async function deleteInboxItem(projectId: string, itemId: string): Promise<boolean> {
  const filePath = path.join(projectPath(projectId), 'inbox', `${itemId}.md`);
  return removeFile(filePath);
}

export async function searchInbox(projectId: string, query: string, limit = 5): Promise<InboxItem[]> {
  const result = await getInboxItems(projectId, { search: query, limit });
  return result.items;
}

export async function getGlobalInboxItems(
  options?: { limit?: number; search?: string }
): Promise<{ items: InboxItem[]; nextCursor?: string }> {
  await ensureDir(GLOBAL_INBOX_ROOT);
  const files = await listFiles(GLOBAL_INBOX_ROOT, '.md');
  let items: InboxItem[] = [];

  for (const file of files) {
    const filePath = path.join(GLOBAL_INBOX_ROOT, file);
    const content = await readText(filePath);
    const stats = await getStats(filePath);
    if (content && stats) {
      const id = file.replace('.md', '');

      items.push({
        id,
        content,
        contentType: 'text',
        metadata: {},
        aiTags: [],
        createdAt: stats.mtime,
        updatedAt: stats.mtime,
      });
    }
  }

  if (options?.search) {
    const search = options.search.toLowerCase();
    items = items.filter((item) => item.content.toLowerCase().includes(search));
  }

  items.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

  const limit = options?.limit || 20;
  return { items: items.slice(0, limit) };
}

export async function createGlobalInboxItem(
  input: { content: string; title?: string }
): Promise<InboxItem> {
  await ensureDir(GLOBAL_INBOX_ROOT);
  const now = new Date();
  const id = `${now.getTime()}-${slugify(input.title || 'note') || generateId()}`;
  const filePath = path.join(GLOBAL_INBOX_ROOT, `${id}.md`);

  let content = input.content;
  if (input.title && !content.startsWith('# ')) {
    content = `# ${input.title}\n\n${content}`;
  }

  await writeText(filePath, content);

  return {
    id,
    content,
    contentType: 'text',
    metadata: {},
    aiTags: [],
    createdAt: now,
    updatedAt: now,
  };
}

export async function deleteGlobalInboxItem(itemId: string): Promise<boolean> {
  const filePath = path.join(GLOBAL_INBOX_ROOT, `${itemId}.md`);
  return removeFile(filePath);
}

export async function getSessionsByVersion(versionId: string): Promise<Session[]> {
  const [projectId, versionFolder] = versionId.split('/');
  if (!projectId || !versionFolder) return [];

  const sessionsDir = path.join(versionPath(projectId, versionFolder), 'sessions');
  const files = await listFiles(sessionsDir, '.json');
  const sessions: Session[] = [];

  for (const file of files) {
    const data = await readJson<SessionData>(path.join(sessionsDir, file));
    if (data) {
      sessions.push({
        id: data.id,
        versionId,
        title: data.title,
        createdAt: new Date(data.createdAt),
        updatedAt: new Date(data.updatedAt),
      });
    }
  }

  return sessions.sort((a, b) => {
    const aNum = Number(a.id);
    const bNum = Number(b.id);
    const aIsNumeric = Number.isFinite(aNum) && String(aNum) === a.id;
    const bIsNumeric = Number.isFinite(bNum) && String(bNum) === b.id;

    if (aIsNumeric && bIsNumeric) {
      return bNum - aNum;
    }
    if (aIsNumeric !== bIsNumeric) {
      return aIsNumeric ? -1 : 1;
    }
    return b.updatedAt.getTime() - a.updatedAt.getTime();
  });
}

export async function getSession(versionId: string, sessionId: string): Promise<Session | null> {
  const [projectId, versionFolder] = versionId.split('/');
  if (!projectId || !versionFolder) return null;

  const sessionPath = path.join(versionPath(projectId, versionFolder), 'sessions', `${sessionId}.json`);
  const data = await readJson<SessionData>(sessionPath);

  if (!data) return null;

  return {
    id: data.id,
    versionId,
    title: data.title,
    createdAt: new Date(data.createdAt),
    updatedAt: new Date(data.updatedAt),
  };
}

export async function createSession(versionId: string, title?: string): Promise<Session> {
  const [projectId, versionFolder] = versionId.split('/');
  if (!projectId || !versionFolder) {
    throw new Error('Invalid versionId');
  }

  const now = new Date();
  const nowIso = now.toISOString();
  const sessionsDir = path.join(versionPath(projectId, versionFolder), 'sessions');
  let id = now.getTime().toString();
  let sessionPath = path.join(sessionsDir, `${id}.json`);
  while (await exists(sessionPath)) {
    id = (Number(id) + 1).toString();
    sessionPath = path.join(sessionsDir, `${id}.json`);
  }

  const data: SessionData = {
    id,
    title,
    createdAt: nowIso,
    updatedAt: nowIso,
    messages: [],
  };

  await writeJson(sessionPath, data);

  return {
    id,
    versionId,
    title,
    createdAt: new Date(nowIso),
    updatedAt: new Date(nowIso),
  };
}

export async function getMessagesBySession(versionId: string, sessionId: string): Promise<Message[]> {
  const [projectId, versionFolder] = versionId.split('/');
  if (!projectId || !versionFolder) return [];

  const sessionPath = path.join(versionPath(projectId, versionFolder), 'sessions', `${sessionId}.json`);
  const data = await readJson<SessionData>(sessionPath);

  if (!data) return [];

  return data.messages.map((m) => ({
    id: m.id,
    sessionId,
    role: m.role,
    content: m.content,
    metadata: {},
    createdAt: new Date(m.createdAt),
  }));
}

export async function createMessage(
  versionId: string,
  input: { sessionId: string; role: Message['role']; content: string }
): Promise<Message> {
  const [projectId, versionFolder] = versionId.split('/');
  if (!projectId || !versionFolder) {
    throw new Error('Invalid versionId');
  }

  const sessionPath = path.join(versionPath(projectId, versionFolder), 'sessions', `${input.sessionId}.json`);
  const data = await readJson<SessionData>(sessionPath);

  if (!data) {
    throw new Error('Session not found');
  }

  const now = new Date().toISOString();
  const message: SessionMessage = {
    id: generateId(),
    role: input.role,
    content: input.content,
    createdAt: now,
  };

  data.messages.push(message);
  data.updatedAt = now;
  await writeJson(sessionPath, data);

  return {
    id: message.id,
    sessionId: input.sessionId,
    role: message.role,
    content: message.content,
    metadata: {},
    createdAt: new Date(now),
  };
}

export async function updateSessionTitle(
  versionId: string,
  sessionId: string,
  title: string
): Promise<boolean> {
  const [projectId, versionFolder] = versionId.split('/');
  if (!projectId || !versionFolder) return false;

  const sessionPath = path.join(versionPath(projectId, versionFolder), 'sessions', `${sessionId}.json`);
  const data = await readJson<SessionData>(sessionPath);
  if (!data) return false;

  const now = new Date().toISOString();
  data.title = title;
  data.updatedAt = now;
  await writeJson(sessionPath, data);
  return true;
}

export async function loadAgentContext(versionId: string): Promise<AgentContext | null> {
  const version = await getVersion(versionId);
  if (!version) return null;

  const project = await getProject(version.projectId);
  if (!project) return null;

  const specOutline = await getSpecOutline(versionId);
  const pendingTodos = specOutline.filter((s) => s.status === 'todo');

  return {
    project,
    version,
    specOutline,
    recentDecisions: [],
    constraints: [],
    pendingTodos,
  };
}

export async function getDecisions(_versionId: string, _limit = 10): Promise<Decision[]> {
  return [];
}

export async function getConstraints(_versionId: string): Promise<Constraint[]> {
  return [];
}

export async function getProjectsWithVersions(): Promise<Array<Project & { versions: Version[] }>> {
  const projects = await getProjects();

  const result = await Promise.all(
    projects.map(async (project) => {
      const versions = await getVersionsByProject(project.id);
      return { ...project, versions };
    })
  );

  return result;
}

function getDefaultSpecTemplate(versionName: string): string {
  return `# ${versionName}

## 概述

简要描述这个版本要解决的问题和目标。

## 用户故事

### 作为 [用户角色]

我希望 [功能描述]
以便 [价值/收益]

## 功能需求

### 核心功能

- [ ] 功能点 1
- [ ] 功能点 2

### 次要功能

- [ ] 功能点 3

## 非功能需求

- 性能要求
- 安全要求
- 兼容性要求

## 约束与假设

### 约束

- 约束 1

### 假设

- 假设 1

## 开放问题

- 问题 1
`;
}
