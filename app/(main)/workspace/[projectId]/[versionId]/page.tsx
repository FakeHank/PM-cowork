'use client';

import { useState, useEffect, useRef, use, useMemo } from 'react';
import { useChat } from '@ai-sdk/react';
import { DefaultChatTransport } from 'ai';
import { Send, Loader2, Bot, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { ChatMessage } from '@/components/chat/chat-message';
import { FolderSelector } from '@/components/workspace/folder-selector';
import { useAppStore, useWorkspaceStore } from '@/stores/app-store';
import type { Project, Version } from '@/lib/types';

interface VersionPageProps {
  params: Promise<{
    projectId: string;
    versionId: string;
  }>;
}

export default function VersionPage({ params }: VersionPageProps) {
  const { projectId, versionId } = use(params);
  const [project, setProject] = useState<Project | null>(null);
  const [version, setVersion] = useState<Version | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [input, setInput] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);
  const { setCurrentProject, setCurrentVersion } = useAppStore();
  const { currentFolderPath } = useWorkspaceStore();

  const fullVersionId = `${projectId}/${versionId}`;

  const transport = useMemo(
    () =>
      new DefaultChatTransport({
        api: '/api/chat',
        body: { versionId: fullVersionId },
      }),
    [fullVersionId]
  );

  const {
    messages,
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
