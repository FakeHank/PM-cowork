'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import { RefreshCw, Code, Eye, Loader2, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { useCanvasStore } from '@/stores/canvas-store';
import { ChatPanel } from '@/components/canvas/chat-panel';
import { PageTabs } from '@/components/canvas/page-tabs';
import { WorkflowProgress } from '@/components/canvas/workflow-progress';
import type { WorkflowEvent } from '@/lib/ai/workflow/types';

export default function CanvasPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const canvasId = params.canvasId as string;
  const shouldGenerate = searchParams.get('generate') === 'true';

  const {
    currentCanvas,
    currentPageId,
    pages,
    viewMode,
    isGenerating,
    workflowStatus,
    workflowStep,
    setViewMode,
    setCanvas,
    setCurrentPage,
    setGenerating,
    setWorkflowStep,
    setWorkflowStatus,
    setWorkflowError,
    setWorkflowDetail,
    resetWorkflow,
  } = useCanvasStore();

  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [generateStatus, setGenerateStatus] = useState<string | null>(null);
  const hasTriggeredGenerate = useRef(false);
  const abortControllerRef = useRef<AbortController | null>(null);

  const loadCanvas = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);

      const response = await fetch(`/api/canvas/${canvasId}`);
      if (!response.ok) {
        throw new Error('Failed to load canvas');
      }

      const canvas = await response.json();
      setCanvas(canvas);
      return canvas;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
      return null;
    } finally {
      setIsLoading(false);
    }
  }, [canvasId, setCanvas]);

  useEffect(() => {
    if (canvasId) {
      loadCanvas();
    }
  }, [canvasId, loadCanvas]);

  useEffect(() => {
    if (currentCanvas && pages.length > 0 && !currentPageId) {
      setCurrentPage(pages[0].id);
    }
  }, [currentCanvas, pages, currentPageId, setCurrentPage]);

  useEffect(() => {
    return () => {
      abortControllerRef.current?.abort();
    };
  }, []);

  const parseSSEChunk = useCallback((chunk: string): WorkflowEvent | null => {
    const lines = chunk.split('\n');
    let event: string | undefined;
    let data: string | undefined;
    
    for (const line of lines) {
      if (line.startsWith('event: ')) {
        event = line.slice(7);
      } else if (line.startsWith('data: ')) {
        data = line.slice(6);
      }
    }
    
    if (event && data) {
      try {
        return { event, ...JSON.parse(data) } as WorkflowEvent;
      } catch {}
    }
    return null;
  }, []);

  const triggerGenerate = useCallback(async () => {
    if (!currentCanvas || hasTriggeredGenerate.current) return;
    hasTriggeredGenerate.current = true;

    setGenerating(true);
    setWorkflowStatus('running');
    setWorkflowStep('architect');

    try {
      abortControllerRef.current = new AbortController();

      const response = await fetch('/api/canvas/workflow', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ versionId: currentCanvas.versionId }),
        signal: abortControllerRef.current.signal,
      });

      if (!response.ok) throw new Error('Workflow failed');

      const reader = response.body!.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n\n');
        buffer = lines.pop() || '';
        
        for (const chunk of lines) {
          const event = parseSSEChunk(chunk);
          if (event) {
            if (event.event === 'step') {
              setWorkflowStep(event.step);
              setWorkflowDetail(event.detail || '');
              if (event.status === 'error') {
                setWorkflowStatus('error');
                setWorkflowError(event.detail || 'Workflow failed');
              }
            } else if (event.event === 'error') {
              setWorkflowStatus('error');
              setWorkflowError(event.error);
            } else if (event.event === 'done') {
              setWorkflowStatus('complete');
              await loadCanvas();
            }
          }
        }
      }
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') {
        setWorkflowStatus('idle');
        resetWorkflow();
      } else {
        setWorkflowStatus('error');
        setWorkflowError(err instanceof Error ? err.message : 'Workflow failed');
      }
    } finally {
      setGenerating(false);
    }
  }, [currentCanvas, setGenerating, setWorkflowStep, setWorkflowStatus, setWorkflowError, setWorkflowDetail, resetWorkflow, loadCanvas, parseSSEChunk]);

  useEffect(() => {
    if (shouldGenerate && currentCanvas && pages.length === 0 && !isGenerating && !hasTriggeredGenerate.current) {
      triggerGenerate();
    }
  }, [shouldGenerate, currentCanvas, pages.length, isGenerating, triggerGenerate]);

  const currentPage = pages.find(p => p.id === currentPageId);
  const htmlContent = currentPage?.htmlContent || '';

  if (isLoading) {
    return (
      <div className="flex flex-col h-full items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        <p className="mt-2 text-muted-foreground">Loading canvas...</p>
      </div>
    );
  }

  if (error && !currentCanvas) {
    return (
      <div className="flex flex-col h-full items-center justify-center">
        <p className="text-destructive">Error: {error}</p>
        <Button onClick={() => window.location.reload()} className="mt-4">
          Retry
        </Button>
      </div>
    );
  }

  if (!currentCanvas) {
    return (
      <div className="flex flex-col h-full items-center justify-center">
        <p className="text-muted-foreground">Canvas not found</p>
      </div>
    );
  }

  if (workflowStatus === 'running' || workflowStatus === 'error') {
    return (
      <WorkflowProgress 
        onComplete={() => { loadCanvas(); resetWorkflow(); }}
        onError={() => { resetWorkflow(); }}
      />
    );
  }

  return (
    <div className="flex flex-col h-full">
      <header className="flex items-center justify-between px-6 py-3 border-b shrink-0">
        <div>
          <h1 className="text-lg font-semibold">{currentCanvas.name}</h1>
          <p className="text-xs text-muted-foreground">
            {pages.length} page{pages.length !== 1 ? 's' : ''}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant={viewMode === 'preview' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setViewMode('preview')}
          >
            <Eye className="h-4 w-4 mr-1" />
            Preview
          </Button>
          <Button
            variant={viewMode === 'code' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setViewMode('code')}
          >
            <Code className="h-4 w-4 mr-1" />
            Code
          </Button>
          <Separator orientation="vertical" className="h-6" />
          <Button
            variant="outline"
            size="sm"
            disabled={isGenerating}
            onClick={triggerGenerate}
          >
            <RefreshCw className={`h-4 w-4 mr-1 ${isGenerating ? 'animate-spin' : ''}`} />
            Regenerate
          </Button>
        </div>
      </header>

      {pages.length > 1 && <PageTabs canvasId={canvasId} />}

      <div className="flex-1 flex overflow-hidden">
        <div className="flex-1 p-4 overflow-auto">
          {viewMode === 'preview' ? (
            <div className="h-full rounded-lg border bg-white overflow-hidden">
              {htmlContent ? (
                <iframe
                  srcDoc={htmlContent}
                  className="w-full h-full border-0"
                  sandbox="allow-scripts"
                  title="Canvas Preview"
                />
              ) : (
                <div className="flex flex-col items-center justify-center h-full text-muted-foreground gap-2">
                  <Sparkles className="h-8 w-8 opacity-40" />
                  <p>No content yet. Use the chat to iterate or click Regenerate.</p>
                </div>
              )}
            </div>
          ) : (
            <div className="h-full rounded-lg border bg-muted p-4 overflow-auto">
              {htmlContent ? (
                <pre className="text-sm font-mono whitespace-pre-wrap">
                  {htmlContent}
                </pre>
              ) : (
                <div className="text-muted-foreground">No code to display</div>
              )}
            </div>
          )}
        </div>
      </div>
      <ChatPanel canvasId={canvasId} />
    </div>
  );
}
