'use client';

import { useState, useEffect, useRef, use, useMemo, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useChat } from '@ai-sdk/react';
import { DefaultChatTransport } from 'ai';
import { Send, Loader2, Bot, RefreshCw, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { ChatMessage } from '@/components/chat/chat-message';
import { FolderSelector } from '@/components/workspace/folder-selector';
import { useAppStore, useWorkspaceStore } from '@/stores/app-store';
import type { UIMessage } from 'ai';
import type { Project, Version, Message as StoredMessage } from '@/lib/types';

interface VersionPageProps {
  params: Promise<{
    projectId: string;
    versionId: string;
  }>;
}

export default function VersionPage({ params }: VersionPageProps) {
  const { projectId, versionId } = use(params);
  const router = useRouter();
  const [project, setProject] = useState<Project | null>(null);
  const [version, setVersion] = useState<Version | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [input, setInput] = useState('');
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [loadedSessionId, setLoadedSessionId] = useState<string | null>(null);
  const [isGeneratingCanvas, setIsGeneratingCanvas] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const sessionIdRef = useRef<string | null>(null);
  const { setCurrentProject, setCurrentVersion, activeSession } = useAppStore();
  const { currentFolderPath } = useWorkspaceStore();

  const fullVersionId = `${projectId}/${versionId}`;

  const sessionStorageKey = useMemo(
    () => `pmwork-session:${fullVersionId}`,
    [fullVersionId]
  );

  const chatFetch = useCallback(
    async (input: RequestInfo | URL, init?: RequestInit) => {
      const response = await fetch(input, init);
      const newSessionId = response.headers.get('X-Session-Id');
      if (newSessionId && newSessionId !== sessionIdRef.current) {
        sessionIdRef.current = newSessionId;
        setSessionId(newSessionId);
        localStorage.setItem(sessionStorageKey, newSessionId);
      }
      return response;
    },
    [sessionStorageKey]
  );

  const transport = useMemo(
    () =>
      new DefaultChatTransport({
        api: '/api/chat',
        body: () => ({
          versionId: fullVersionId,
          sessionId: sessionIdRef.current ?? undefined,
        }),
        fetch: chatFetch,
      }),
    [fullVersionId, chatFetch]
  );

  const {
    messages,
    setMessages,
    sendMessage,
    status,
    error,
    regenerate,
    clearError,
  } = useChat({
    transport,
  });

  const isChatLoading = status === 'streaming' || status === 'submitted';

  useEffect(() => {
    const storedSessionId = localStorage.getItem(sessionStorageKey);
    sessionIdRef.current = storedSessionId;
    setSessionId(storedSessionId);
    setLoadedSessionId(null);
  }, [sessionStorageKey]);

  useEffect(() => {
    if (!activeSession) return;
    if (activeSession.versionId !== fullVersionId) return;
    if (activeSession.sessionId === sessionIdRef.current) return;

    sessionIdRef.current = activeSession.sessionId;
    setSessionId(activeSession.sessionId);
    setLoadedSessionId(null);
    setMessages([]);
    localStorage.setItem(sessionStorageKey, activeSession.sessionId);
  }, [activeSession, fullVersionId, sessionStorageKey, setMessages]);

  const toUIMessages = useCallback((items: StoredMessage[]): UIMessage[] => {
    return items
      .filter((item) => item.role === 'user' || item.role === 'assistant')
      .map((item) => ({
        id: item.id,
        role: item.role,
        parts: [{ type: 'text', text: item.content }],
      }));
  }, []);

  useEffect(() => {
    if (!sessionId || sessionId === loadedSessionId) return;
    if (messages.length > 0) {
      setLoadedSessionId(sessionId);
      return;
    }

    let isActive = true;
    const loadHistory = async () => {
      try {
        const res = await fetch(
          `/api/chat/session?versionId=${encodeURIComponent(fullVersionId)}&sessionId=${encodeURIComponent(sessionId)}`
        );

        if (!res.ok) {
          if (res.status === 404) {
            localStorage.removeItem(sessionStorageKey);
            sessionIdRef.current = null;
            setSessionId(null);
          }
          return;
        }

        const { data } = await res.json();
        const history = toUIMessages(data?.messages || []);
        if (isActive && history.length > 0) {
          setMessages((current) => (current.length === 0 ? history : current));
        }
      } catch (err) {
        console.error('Failed to load session history:', err);
      } finally {
        if (isActive) {
          setLoadedSessionId(sessionId);
        }
      }
    };

    loadHistory();

    return () => {
      isActive = false;
    };
  }, [
    sessionId,
    loadedSessionId,
    fullVersionId,
    messages.length,
    sessionStorageKey,
    setMessages,
    toUIMessages,
  ]);

  useEffect(() => {
    async function fetchData() {
      try {
        const [projectRes, versionRes] = await Promise.all([
          fetch(`/api/projects/${projectId}`),
          fetch(`/api/projects/${projectId}/versions/${versionId}`),
        ]);

        if (projectRes.ok) {
          const { data } = await projectRes.json();
          setProject(data);
          setCurrentProject(data);
        }
        if (versionRes.ok) {
          const { data } = await versionRes.json();
          setVersion(data);
          setCurrentVersion(data);
        }
      } catch (err) {
        console.error('Failed to fetch data:', err);
      } finally {
        setIsLoading(false);
      }
    }

    fetchData();

    return () => {
      setCurrentProject(null);
      setCurrentVersion(null);
    };
  }, [projectId, versionId, setCurrentProject, setCurrentVersion]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isChatLoading) return;
    
    const messageContent = input;
    setInput('');
    await sendMessage({ text: messageContent });
  };

  const handleGenerateCanvas = async () => {
    try {
      setIsGeneratingCanvas(true);
      
      // Check if canvas already exists
      const checkRes = await fetch(`/api/canvas?versionId=${encodeURIComponent(fullVersionId)}`);
      if (checkRes.ok) {
        const { data } = await checkRes.json();
        if (data && data.id) {
          // Canvas exists, navigate to it
          router.push(`/canvas/${data.id}`);
          return;
        }
      }
      
      // Canvas doesn't exist, create one
      const createRes = await fetch('/api/canvas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          versionId: fullVersionId,
          name: `Canvas - ${version?.name || 'Untitled'}`,
        }),
      });
      
      if (!createRes.ok) {
        const error = await createRes.json();
        throw new Error(error.error || 'Failed to create canvas');
      }
      
      const { data } = await createRes.json();
      router.push(`/canvas/${data.id}`);
    } catch (error) {
      console.error('Failed to generate canvas:', error);
      alert(error instanceof Error ? error.message : 'Failed to generate canvas');
    } finally {
      setIsGeneratingCanvas(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex flex-col h-full">
        <header className="flex items-center justify-between px-6 py-4 border-b">
          <div>
            <Skeleton className="h-6 w-48" />
            <Skeleton className="h-4 w-24 mt-1" />
          </div>
        </header>
        <div className="flex-1 p-6">
          <Skeleton className="h-20 w-full max-w-3xl mx-auto" />
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      <header className="flex items-center justify-between px-6 py-3 border-b">
        <div className="flex items-center gap-3">
          <FolderSelector
            projectName={project?.name}
            versionName={version?.name}
            currentPath={currentFolderPath || undefined}
          />
          <Badge variant={version?.status === 'active' ? 'default' : 'secondary'}>
            {version?.status || 'active'}
          </Badge>
        </div>
        <Button
          onClick={handleGenerateCanvas}
          disabled={isGeneratingCanvas}
          size="sm"
          className="gap-2"
        >
          {isGeneratingCanvas ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Sparkles className="h-4 w-4" />
          )}
          Generate Canvas
        </Button>
      </header>

      <ScrollArea className="flex-1 p-6" ref={scrollRef}>
        <div className="max-w-3xl mx-auto space-y-6">
          {messages.length === 0 && (
            <div className="text-center py-12">
              <Bot className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <h2 className="text-lg font-medium mb-2">开始对话</h2>
              <p className="text-muted-foreground text-sm max-w-md mx-auto">
                我是 PMWork AI 助手，可以帮你撰写和完善产品需求文档。
                试着说「帮我写用户故事」或「检查一下文档完整性」
              </p>
            </div>
          )}

          {messages.map((message) => (
            <ChatMessage key={message.id} message={message} />
          ))}

          {isChatLoading && messages[messages.length - 1]?.role === 'user' && (
            <div className="flex gap-3">
              <div className="h-8 w-8 rounded-full bg-primary flex items-center justify-center shrink-0">
                <Bot className="h-4 w-4 text-primary-foreground" />
              </div>
              <div className="rounded-lg px-4 py-3 bg-muted">
                <Loader2 className="h-4 w-4 animate-spin" />
              </div>
            </div>
          )}

          {error && (
            <div className="flex items-center gap-2 p-4 rounded-lg bg-red-50 text-red-800 text-sm">
              <span>出错了: {error.message}</span>
              <Button variant="ghost" size="sm" onClick={() => { clearError(); regenerate(); }}>
                <RefreshCw className="h-3 w-3 mr-1" />
                重试
              </Button>
            </div>
          )}
        </div>
      </ScrollArea>

      <div className="border-t p-4">
        <form onSubmit={handleSubmit} className="max-w-3xl mx-auto flex gap-2">
          <Textarea
            placeholder="输入你的需求，例如「帮我写用户故事」..."
            value={input}
            onChange={(e) => setInput(e.target.value)}
            className="min-h-[60px] max-h-[200px] resize-none"
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSubmit(e);
              }
            }}
          />
          <Button
            type="submit"
            disabled={isChatLoading || !input.trim()}
            size="icon"
            className="shrink-0 h-[60px] w-[60px]"
          >
            {isChatLoading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
          </Button>
        </form>
        <p className="text-xs text-muted-foreground text-center mt-2">
          按 Enter 发送，Shift+Enter 换行
        </p>
      </div>
    </div>
  );
}
