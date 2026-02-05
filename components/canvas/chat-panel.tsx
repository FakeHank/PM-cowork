'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { MessageCircle, Send, ChevronUp, ChevronDown, Loader2, Square, Undo2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import { useCanvasStore } from '@/stores/canvas-store';
import { Timeline } from '@/components/canvas/timeline';

interface ChatPanelProps {
  canvasId: string;
}

const MIN_HEIGHT = 48;
const MAX_HEIGHT = 600;

export function ChatPanel({ canvasId }: ChatPanelProps) {
  const {
    messages,
    chatPanelOpen,
    chatPanelHeight,
    activeChatTab,
    isGenerating,
    currentCanvas,
    currentPageId,
    pages,
    addMessage,
    setChatPanelHeight,
    toggleChatPanel,
    setActiveChatTab,
    setGenerating,
    setCanvas,
  } = useCanvasStore();

  const [input, setInput] = useState('');
  const [isDragging, setIsDragging] = useState(false);
  const [streamingStatus, setStreamingStatus] = useState<string | null>(null);
  const [undoableMessageId, setUndoableMessageId] = useState<string | null>(null);
  const [isUndoing, setIsUndoing] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const chatPanelHeightRef = useRef(chatPanelHeight);
  chatPanelHeightRef.current = chatPanelHeight;
  const abortControllerRef = useRef<AbortController | null>(null);

  const currentPage = pages.find(p => p.id === currentPageId);

  useEffect(() => {
    if (messages.length > 0) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages]);

  useEffect(() => {
    if (!isDragging) return;

    const panel = panelRef.current;
    let lastY = 0;

    const onMouseMove = (e: MouseEvent) => {
      if (lastY === 0) {
        lastY = e.clientY;
        return;
      }
      const delta = lastY - e.clientY;
      lastY = e.clientY;
      setChatPanelHeight(Math.min(Math.max(chatPanelHeightRef.current + delta, MIN_HEIGHT), MAX_HEIGHT));
    };

    const onMouseUp = () => setIsDragging(false);
    const onMouseLeave = () => setIsDragging(false);

    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
    panel?.addEventListener('mouseleave', onMouseLeave);
    return () => {
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
      panel?.removeEventListener('mouseleave', onMouseLeave);
    };
  }, [isDragging, setChatPanelHeight]);

  const reloadCanvas = useCallback(async () => {
    try {
      const res = await fetch(`/api/canvas/${canvasId}`);
      if (res.ok) {
        const canvas = await res.json();
        setCanvas(canvas);
      }
    } catch {}
  }, [canvasId, setCanvas]);

  const handleAbort = useCallback(() => {
    abortControllerRef.current?.abort();
  }, []);

  const handleSend = async () => {
    if (!input.trim() || isGenerating) return;
    if (!currentCanvas || !currentPageId || !currentPage) return;

    const prompt = input.trim();
    setInput('');
    setUndoableMessageId(null);

    addMessage({
      id: Date.now().toString(),
      role: 'user',
      content: prompt,
      timestamp: new Date().toISOString(),
    });

    setGenerating(true);
    setStreamingStatus('Connecting...');

    const controller = new AbortController();
    abortControllerRef.current = controller;

    try {
      const response = await fetch('/api/canvas/iterate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          versionId: currentCanvas.versionId,
          pageId: currentPageId,
          currentHtml: currentPage.htmlContent || '',
          userPrompt: prompt,
        }),
        signal: controller.signal,
      });

      if (!response.ok) {
        const err = await response.json().catch(() => ({ error: 'Request failed' }));
        throw new Error(err.error || 'Failed to iterate');
      }

      const reader = response.body?.getReader();
      if (!reader) throw new Error('No response stream');

      const decoder = new TextDecoder();
      let buffer = '';
      let finalMessage = 'Canvas updated.';
      let hadError = false;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        let eventType = '';
        for (const line of lines) {
          if (line.startsWith('event: ')) {
            eventType = line.slice(7).trim();
          } else if (line.startsWith('data: ') && eventType) {
            try {
              const payload = JSON.parse(line.slice(6));
              if (eventType === 'status') {
                setStreamingStatus(payload.message);
              } else if (eventType === 'done') {
                finalMessage = payload.message || 'Canvas updated.';
              } else if (eventType === 'error') {
                hadError = true;
                finalMessage = payload.message || 'Something went wrong.';
              }
            } catch {}
            eventType = '';
          }
        }
      }

      if (!hadError) {
        await reloadCanvas();
      }

      const msgId = (Date.now() + 1).toString();
      addMessage({
        id: msgId,
        role: 'assistant',
        content: finalMessage,
        timestamp: new Date().toISOString(),
      });

      if (!hadError) {
        setUndoableMessageId(msgId);
      }
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') {
        addMessage({
          id: (Date.now() + 1).toString(),
          role: 'assistant',
          content: 'Generation stopped.',
          timestamp: new Date().toISOString(),
        });
      } else {
        addMessage({
          id: (Date.now() + 1).toString(),
          role: 'assistant',
          content: error instanceof Error ? error.message : 'Something went wrong.',
          timestamp: new Date().toISOString(),
        });
      }
    } finally {
      abortControllerRef.current = null;
      setGenerating(false);
      setStreamingStatus(null);
    }
  };

  const handleUndo = async () => {
    if (!currentCanvas || !currentPageId || isUndoing) return;

    setIsUndoing(true);
    try {
      const response = await fetch(`/api/canvas/${canvasId}/revert`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          versionId: currentCanvas.versionId,
          pageId: currentPageId,
          commitHash: 'HEAD~1',
        }),
      });

      if (!response.ok) {
        const err = await response.json().catch(() => ({ error: 'Undo failed' }));
        throw new Error(err.error || 'Undo failed');
      }

      setUndoableMessageId(null);
      await reloadCanvas();

      addMessage({
        id: Date.now().toString(),
        role: 'assistant',
        content: 'Change reverted.',
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      addMessage({
        id: Date.now().toString(),
        role: 'assistant',
        content: error instanceof Error ? error.message : 'Undo failed.',
        timestamp: new Date().toISOString(),
      });
    } finally {
      setIsUndoing(false);
    }
  };

  const collapsed = !chatPanelOpen;

  return (
    <div
      ref={panelRef}
      className={cn(
        'fixed bottom-0 right-0 w-[420px] bg-background border-l border-t rounded-tl-xl shadow-2xl flex flex-col z-50 transition-[height] duration-200',
        isDragging && 'select-none transition-none'
      )}
      style={{ height: collapsed ? MIN_HEIGHT : chatPanelHeight }}
    >
      {!collapsed && (
        <hr
          aria-orientation="horizontal"
          className="h-1.5 cursor-ns-resize flex items-center justify-center shrink-0 hover:bg-primary/10 transition-colors rounded-tl-xl border-0 m-0"
          onMouseDown={(e) => { e.preventDefault(); setIsDragging(true); }}
        />
      )}

      <div
        className={cn(
          'flex items-center justify-between px-4 shrink-0 border-b',
          collapsed ? 'py-3' : 'py-2'
        )}
      >
        <div className="flex gap-1">
          <Button
            variant={activeChatTab === 'chat' ? 'secondary' : 'ghost'}
            size="sm"
            className="h-7 text-xs"
            onClick={(e) => {
              e.stopPropagation();
              if (collapsed) toggleChatPanel();
              setActiveChatTab('chat');
            }}
          >
            <MessageCircle className="h-3.5 w-3.5 mr-1" />
            Chat
          </Button>
          <Button
            variant={activeChatTab === 'timeline' ? 'secondary' : 'ghost'}
            size="sm"
            className="h-7 text-xs"
            onClick={(e) => {
              e.stopPropagation();
              if (collapsed) toggleChatPanel();
              setActiveChatTab('timeline');
            }}
          >
            History
          </Button>
        </div>
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7"
          onClick={(e) => { e.stopPropagation(); toggleChatPanel(); }}
        >
          {collapsed ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </Button>
      </div>

      {!collapsed && (
        <div className="flex-1 overflow-hidden flex flex-col min-h-0">
          {activeChatTab === 'chat' ? (
            <>
              <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
                {messages.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
                    <MessageCircle className="h-8 w-8 mb-2 opacity-40" />
                    <p className="text-sm">Describe changes to iterate on your canvas</p>
                  </div>
                ) : (
                  messages.map((msg) => (
                    <div
                      key={msg.id}
                      className={cn(
                        'flex',
                        msg.role === 'user' ? 'justify-end' : 'justify-start'
                      )}
                    >
                      <div className="flex items-start gap-1.5 max-w-[85%]">
                        <div
                          className={cn(
                            'rounded-lg px-3 py-2 text-sm',
                            msg.role === 'user'
                              ? 'bg-primary text-primary-foreground'
                              : 'bg-muted'
                          )}
                        >
                          {msg.content}
                        </div>
                        {msg.role === 'assistant' && msg.id === undoableMessageId && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 shrink-0 text-muted-foreground hover:text-foreground"
                            onClick={handleUndo}
                            disabled={isUndoing}
                            title="Undo this change"
                          >
                            {isUndoing ? (
                              <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            ) : (
                              <Undo2 className="h-3.5 w-3.5" />
                            )}
                          </Button>
                        )}
                      </div>
                    </div>
                  ))
                )}
                {isGenerating && (
                  <div className="flex justify-start">
                    <div className="bg-muted rounded-lg px-3 py-2 text-sm flex items-center gap-2 text-muted-foreground">
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      {streamingStatus || 'Updating canvas...'}
                    </div>
                  </div>
                )}
                <div ref={messagesEndRef} />
              </div>

              <div className="p-3 border-t shrink-0">
                <div className="flex gap-2">
                  <Textarea
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    placeholder={currentPage ? 'Describe changes...' : 'No page selected'}
                    className="min-h-[44px] max-h-[100px] resize-none text-sm"
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        handleSend();
                      }
                    }}
                    disabled={isGenerating || !currentPage}
                  />
                  {isGenerating ? (
                    <Button
                      onClick={handleAbort}
                      variant="destructive"
                      size="icon"
                      className="shrink-0 h-[44px] w-[44px]"
                      title="Stop generation"
                    >
                      <Square className="h-4 w-4" />
                    </Button>
                  ) : (
                    <Button
                      onClick={handleSend}
                      disabled={!input.trim() || !currentPage}
                      size="icon"
                      className="shrink-0 h-[44px] w-[44px]"
                    >
                      <Send className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              </div>
            </>
          ) : (
            <Timeline canvasId={canvasId} versionId={currentCanvas?.versionId} pageId={currentPageId} />
          )}
        </div>
      )}
    </div>
  );
}
