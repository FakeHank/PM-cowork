'use client';

import { useEffect, useState } from 'react';
import { GitCommit, RotateCcw, Clock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useCanvasStore } from '@/stores/canvas-store';

interface TimelineProps {
  canvasId: string;
  versionId?: string;
  pageId?: string | null;
}

interface Commit {
  hash: string;
  message: string;
  date: string;
  author: string;
}

export function Timeline({ canvasId, versionId, pageId }: TimelineProps) {
  const [commits, setCommits] = useState<Commit[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [revertingHash, setRevertingHash] = useState<string | null>(null);
  
  const { setCanvas } = useCanvasStore();

  useEffect(() => {
    async function loadHistory() {
      try {
        setIsLoading(true);
        setError(null);
        
        const params = new URLSearchParams();
        if (versionId) params.set('versionId', versionId);
        
        const response = await fetch(`/api/canvas/${canvasId}/history?${params.toString()}`);
        if (!response.ok) {
          throw new Error('Failed to load history');
        }
        
        const json = await response.json();
        setCommits(json.data ?? json);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unknown error');
      } finally {
        setIsLoading(false);
      }
    }
    
    if (canvasId && versionId) {
      loadHistory();
    }
  }, [canvasId, versionId]);

  const handleRevert = async (commitHash: string) => {
    if (!confirm('Are you sure you want to revert to this version?')) {
      return;
    }

    try {
      setRevertingHash(commitHash);
      
      const response = await fetch(`/api/canvas/${canvasId}/revert`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ versionId, pageId, commitHash }),
      });

      if (!response.ok) {
        throw new Error('Failed to revert');
      }

      // Reload canvas data
      const canvasResponse = await fetch(`/api/canvas/${canvasId}`);
      if (canvasResponse.ok) {
        const canvas = await canvasResponse.json();
        setCanvas(canvas);
      }

      // Reload history
      const params = new URLSearchParams();
      if (versionId) params.set('versionId', versionId);
      const historyResponse = await fetch(`/api/canvas/${canvasId}/history?${params.toString()}`);
      if (historyResponse.ok) {
        const json = await historyResponse.json();
        setCommits(json.data ?? json);
      }
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to revert');
    } finally {
      setRevertingHash(null);
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const formatHash = (hash: string) => {
    return hash.substring(0, 7);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
        <p>Failed to load history</p>
        <Button onClick={() => window.location.reload()} variant="outline" size="sm" className="mt-2">
          Retry
        </Button>
      </div>
    );
  }

  if (commits.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
        <GitCommit className="h-12 w-12 mb-2 opacity-50" />
        <p>No history yet</p>
        <p className="text-sm">Changes will appear here</p>
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-auto p-4">
      <div className="space-y-4">
        {commits.map((commit, index) => (
          <div key={commit.hash} className="flex gap-3">
            {/* Timeline line */}
            <div className="flex flex-col items-center">
              <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                <GitCommit className="h-4 w-4 text-primary" />
              </div>
              {index < commits.length - 1 && (
                <div className="w-0.5 flex-1 bg-border mt-2" />
              )}
            </div>

            {/* Commit info */}
            <div className="flex-1 pb-4">
              <div className="bg-card rounded-lg p-3 border">
                <p className="font-medium text-sm line-clamp-2">{commit.message}</p>
                <div className="flex items-center gap-2 mt-2 text-xs text-muted-foreground">
                  <code className="bg-muted px-1 py-0.5 rounded">
                    {formatHash(commit.hash)}
                  </code>
                  <span>•</span>
                  <Clock className="h-3 w-3" />
                  <span>{formatDate(commit.date)}</span>
                </div>
                
                {index > 0 && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="mt-2 h-7 text-xs"
                    onClick={() => handleRevert(commit.hash)}
                    disabled={revertingHash === commit.hash}
                  >
                    {revertingHash === commit.hash ? (
                      <div className="h-3 w-3 animate-spin rounded-full border-2 border-current border-t-transparent mr-1" />
                    ) : (
                      <RotateCcw className="h-3 w-3 mr-1" />
                    )}
                    Revert
                  </Button>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
