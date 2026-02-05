import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import {
  DEFAULT_MARKDOWN_SETTINGS,
  type Project,
  type Version,
  type InboxItem,
  type Session,
  type ProviderSettings,
  type AppSettings,
  type MarkdownSettings,
} from '@/lib/types';

interface AppState {
  currentProject: Project | null;
  currentVersion: Version | null;
  currentSession: Session | null;
  activeSession: { versionId: string; sessionId: string } | null;
  
  sidebarCollapsed: boolean;
  sidebarWidth: number;
  rightPanelOpen: boolean;
  rightPanelWidth: number;
  
  setCurrentProject: (project: Project | null) => void;
  setCurrentVersion: (version: Version | null) => void;
  setCurrentSession: (session: Session | null) => void;
  setActiveSession: (session: { versionId: string; sessionId: string } | null) => void;
  toggleSidebar: () => void;
  setSidebarWidth: (width: number) => void;
  toggleRightPanel: () => void;
  setRightPanelWidth: (width: number) => void;
}

const SIDEBAR_MIN = 200;
const SIDEBAR_MAX = 400;
const RIGHT_PANEL_MIN = 320;
const RIGHT_PANEL_MAX = 700;

export const useAppStore = create<AppState>((set) => ({
  currentProject: null,
  currentVersion: null,
  currentSession: null,
  activeSession: null,
  
  sidebarCollapsed: false,
  sidebarWidth: 256,
  rightPanelOpen: true,
  rightPanelWidth: 420,
  
  setCurrentProject: (project) => set({ currentProject: project }),
  setCurrentVersion: (version) => set({ currentVersion: version }),
  setCurrentSession: (session) => set({ currentSession: session }),
  setActiveSession: (session) => set({ activeSession: session }),
  toggleSidebar: () => set((state) => ({ sidebarCollapsed: !state.sidebarCollapsed })),
  setSidebarWidth: (width) => set({ sidebarWidth: Math.max(SIDEBAR_MIN, Math.min(SIDEBAR_MAX, width)) }),
  toggleRightPanel: () => set((state) => ({ rightPanelOpen: !state.rightPanelOpen })),
  setRightPanelWidth: (width) => set({ rightPanelWidth: Math.max(RIGHT_PANEL_MIN, Math.min(RIGHT_PANEL_MAX, width)) }),
}));

interface InboxState {
  items: InboxItem[];
  isLoading: boolean;
  searchQuery: string;
  
  setItems: (items: InboxItem[]) => void;
  addItem: (item: InboxItem) => void;
  setLoading: (loading: boolean) => void;
  setSearchQuery: (query: string) => void;
}

export const useInboxStore = create<InboxState>((set) => ({
  items: [],
  isLoading: false,
  searchQuery: '',
  
  setItems: (items) => set({ items }),
  addItem: (item) => set((state) => ({ items: [item, ...state.items] })),
  setLoading: (isLoading) => set({ isLoading }),
  setSearchQuery: (searchQuery) => set({ searchQuery }),
}));

interface ChatState {
  messages: Array<{ role: 'user' | 'assistant'; content: string; id: string }>;
  isStreaming: boolean;
  pendingChanges: Array<{ id: string; diff: string; reason: string }>;
  
  addMessage: (message: { role: 'user' | 'assistant'; content: string; id: string }) => void;
  updateLastMessage: (content: string) => void;
  clearMessages: () => void;
  setStreaming: (streaming: boolean) => void;
  addPendingChange: (change: { id: string; diff: string; reason: string }) => void;
  removePendingChange: (id: string) => void;
}

export const useChatStore = create<ChatState>((set) => ({
  messages: [],
  isStreaming: false,
  pendingChanges: [],
  
  addMessage: (message) => set((state) => ({ messages: [...state.messages, message] })),
  updateLastMessage: (content) => set((state) => {
    const messages = [...state.messages];
    if (messages.length > 0) {
      messages[messages.length - 1] = { ...messages[messages.length - 1], content };
    }
    return { messages };
  }),
  clearMessages: () => set({ messages: [] }),
  setStreaming: (isStreaming) => set({ isStreaming }),
  addPendingChange: (change) => set((state) => ({ 
    pendingChanges: [...state.pendingChanges, change] 
  })),
  removePendingChange: (id) => set((state) => ({ 
    pendingChanges: state.pendingChanges.filter(c => c.id !== id) 
  })),
}));

interface RecentFolder {
  path: string;
  projectName: string;
  versionName: string;
}

interface WorkspaceState {
  currentFolderPath: string | null;
  recentFolders: RecentFolder[];
  
  setCurrentFolderPath: (path: string | null) => void;
  addRecentFolder: (folder: RecentFolder) => void;
  clearRecentFolders: () => void;
}

const MAX_RECENT_FOLDERS = 10;

export const useWorkspaceStore = create<WorkspaceState>()(
  persist(
    (set) => ({
      currentFolderPath: null,
      recentFolders: [],
      
      setCurrentFolderPath: (path) => set({ currentFolderPath: path }),
      addRecentFolder: (folder) => set((state) => {
        const filtered = state.recentFolders.filter((f) => f.path !== folder.path);
        return { recentFolders: [folder, ...filtered].slice(0, MAX_RECENT_FOLDERS) };
      }),
      clearRecentFolders: () => set({ recentFolders: [] }),
    }),
    {
      name: 'pmwork-workspace',
    }
  )
);

interface RecentChat {
  key: string;
  title: string;
  kind: 'workspace' | 'canvas';
  href: string;
  sessionId?: string;
  versionId?: string;
  canvasId?: string;
  context?: string;
  updatedAt: string;
}

interface RecentsState {
  chats: RecentChat[];
  upsertChat: (chat: RecentChat) => void;
  removeChat: (key: string) => void;
  clearChats: () => void;
}

const MAX_RECENT_CHATS = 12;

export const useRecentsStore = create<RecentsState>()(
  persist(
    (set) => ({
      chats: [],
      upsertChat: (chat) =>
        set((state) => {
          const filtered = state.chats.filter((item) => item.key !== chat.key);
          const next = [chat, ...filtered];
          return { chats: next.slice(0, MAX_RECENT_CHATS) };
        }),
      removeChat: (key) =>
        set((state) => ({
          chats: state.chats.filter((item) => item.key !== key),
        })),
      clearChats: () => set({ chats: [] }),
    }),
    { name: 'pmwork-recents' }
  )
);

const DEFAULT_PROVIDER_SETTINGS: ProviderSettings = {
  provider: 'anthropic',
  defaultModel: 'claude-sonnet-4-20250514',
};
const DEFAULT_SETTINGS: AppSettings = {
  provider: DEFAULT_PROVIDER_SETTINGS,
  theme: 'system',
  markdown: DEFAULT_MARKDOWN_SETTINGS,
};

const normalizeSettings = (settings?: AppSettings): AppSettings => ({
  ...DEFAULT_SETTINGS,
  ...settings,
  provider: { ...DEFAULT_PROVIDER_SETTINGS, ...settings?.provider },
  markdown: { ...DEFAULT_MARKDOWN_SETTINGS, ...settings?.markdown },
});

interface SettingsState {
  settings: AppSettings;
  isLoading: boolean;
  
  setProviderSettings: (provider: ProviderSettings) => void;
  setMarkdownSettings: (markdown: MarkdownSettings) => void;
  setSettings: (settings: AppSettings) => void;
  setLoading: (loading: boolean) => void;
  resetSettings: () => void;
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      settings: normalizeSettings(),
      isLoading: false,
      
      setProviderSettings: (provider) => set((state) => ({
        settings: { ...state.settings, provider }
      })),
      setMarkdownSettings: (markdown) => set((state) => ({
        settings: { ...state.settings, markdown }
      })),
      setSettings: (settings) => set({ settings: normalizeSettings(settings) }),
      setLoading: (isLoading) => set({ isLoading }),
      resetSettings: () => set({
        settings: normalizeSettings(),
      }),
    }),
    {
      name: 'pmwork-settings',
    }
  )
);
