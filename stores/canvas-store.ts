import { create } from 'zustand';
import type { CanvasData, CanvasPageData } from '@/lib/fs/canvas-types';

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
}

interface CanvasState {
  currentCanvas: CanvasData | null;
  currentPageId: string | null;
  pages: CanvasPageData[];
  
  isGenerating: boolean;
  viewMode: 'preview' | 'code';
  chatPanelOpen: boolean;
  chatPanelHeight: number;
  activeChatTab: 'chat' | 'timeline';
  
  messages: ChatMessage[];
  
  workflowStep: 'architect' | 'planner' | 'coder' | 'reviewer' | null;
  workflowStatus: 'idle' | 'running' | 'complete' | 'error';
  workflowError: string | null;
  workflowDetail: string | null;
  
  setCanvas: (canvas: CanvasData | null) => void;
  setCurrentPage: (pageId: string | null) => void;
  addPage: (page: CanvasPageData) => void;
  updatePage: (pageId: string, updates: Partial<CanvasPageData>) => void;
  setGenerating: (isGenerating: boolean) => void;
  setViewMode: (mode: 'preview' | 'code') => void;
  toggleChatPanel: () => void;
  setChatPanelHeight: (height: number) => void;
  setActiveChatTab: (tab: 'chat' | 'timeline') => void;
  addMessage: (message: ChatMessage) => void;
  clearMessages: () => void;
  setWorkflowStep: (step: CanvasState['workflowStep']) => void;
  setWorkflowStatus: (status: CanvasState['workflowStatus']) => void;
  setWorkflowError: (error: string | null) => void;
  setWorkflowDetail: (detail: string | null) => void;
  resetWorkflow: () => void;
}

export const useCanvasStore = create<CanvasState>((set) => ({
  currentCanvas: null,
  currentPageId: null,
  pages: [],
  
  isGenerating: false,
  viewMode: 'preview',
  chatPanelOpen: true,
  chatPanelHeight: 300,
  activeChatTab: 'chat',
  
  messages: [],
  
  workflowStep: null,
  workflowStatus: 'idle',
  workflowError: null,
  workflowDetail: null,
  
  setCanvas: (canvas) => set({ 
    currentCanvas: canvas,
    pages: canvas?.pages ?? [],
  }),
  
  setCurrentPage: (pageId) => set({ currentPageId: pageId }),
  
  addPage: (page) => set((state) => ({
    pages: [...state.pages, page]
  })),
  
  updatePage: (pageId, updates) => set((state) => ({
    pages: state.pages.map((page) =>
      page.id === pageId ? { ...page, ...updates } : page
    )
  })),
  
  setGenerating: (isGenerating) => set({ isGenerating }),
  
  setViewMode: (mode) => set({ viewMode: mode }),
  
  toggleChatPanel: () => set((state) => ({
    chatPanelOpen: !state.chatPanelOpen
  })),
  
  setChatPanelHeight: (height) => set({ chatPanelHeight: height }),
  
  setActiveChatTab: (tab) => set({ activeChatTab: tab }),
  
  addMessage: (message) => set((state) => ({
    messages: [...state.messages, message]
  })),
  
  clearMessages: () => set({ messages: [] }),
  
  setWorkflowStep: (step) => set({ workflowStep: step }),
  
  setWorkflowStatus: (status) => set({ workflowStatus: status }),
  
  setWorkflowError: (error) => set({ workflowError: error }),
  
  setWorkflowDetail: (detail) => set({ workflowDetail: detail }),
  
  resetWorkflow: () => set({
    workflowStep: null,
    workflowStatus: 'idle',
    workflowError: null,
    workflowDetail: null,
  }),
}));
