export interface ProjectMeta {
  id: string;
  name: string;
  description?: string;
  createdAt: string;
  updatedAt: string;
}

export interface VersionMeta {
  id: string;
  name: string;
  status: 'active' | 'done';
  createdAt: string;
  updatedAt: string;
}

export interface SessionMeta {
  id: string;
  title?: string;
  createdAt: string;
  updatedAt: string;
}

export interface SessionMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  createdAt: string;
}

export interface SessionData extends SessionMeta {
  messages: SessionMessage[];
}

export interface InboxItemMeta {
  id: string;
  title: string;
  contentType: 'text' | 'file' | 'image' | 'link';
  tags: string[];
  createdAt: string;
  updatedAt: string;
}
