'use client';

import { useState, useEffect } from 'react';
import { ArrowLeft, FileText, Image, File, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { MarkdownPreview } from '@/components/files/markdown-preview';

interface FilePreviewProps {
  versionId: string;
  filePath: string;
  onBack: () => void;
  onContinueSession?: (sessionId: string) => void;
}

function getFileType(fileName: string): 'markdown' | 'image' | 'text' | 'unknown' {
  const ext = fileName.split('.').pop()?.toLowerCase();
  
  switch (ext) {
    case 'md':
    case 'markdown':
      return 'markdown';
    case 'png':
    case 'jpg':
    case 'jpeg':
    case 'gif':
    case 'svg':
    case 'webp':
      return 'image';
    case 'txt':
    case 'json':
    case 'yaml':
    case 'yml':
    case 'xml':
    case 'html':
    case 'css':
    case 'js':
    case 'ts':
    case 'tsx':
    case 'jsx':
      return 'text';
    default:
      return 'unknown';
  }
}

function getSessionIdFromPath(filePath: string): string | null {
  if (!filePath.startsWith('sessions/')) return null;
  const fileName = filePath.split('/').pop() || '';
  if (!fileName.endsWith('.json')) return null;
  return fileName.replace(/\.json$/, '');
}

export function FilePreview({ versionId, filePath, onBack, onContinueSession }: FilePreviewProps) {
  const [content, setContent] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fileName = filePath.split('/').pop() || filePath;
  const fileType = getFileType(fileName);
  const sessionId = getSessionIdFromPath(filePath);

  useEffect(() => {
    async function fetchContent() {
      setIsLoading(true);
      setError(null);
      
      try {
        const res = await fetch(`/api/files?versionId=${versionId}&path=${encodeURIComponent(filePath)}`);
        if (res.ok) {
          const { data } = await res.json();
          setContent(data.content);
        } else {
          setError('Failed to load file');
        }
      } catch (err) {
        console.error('Failed to fetch file:', err);
        setError('Failed to load file');
      } finally {
        setIsLoading(false);
      }
    }

    if (fileType !== 'image') {
      fetchContent();
    } else {
      setIsLoading(false);
    }
  }, [versionId, filePath, fileType]);

  return (
    <div className="flex flex-col h-full min-h-0">
      <div className="flex items-center gap-2 px-3 py-2 border-b bg-muted/30">
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7"
          onClick={onBack}
        >
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex items-center gap-2 flex-1 min-w-0">
          {fileType === 'markdown' ? (
            <FileText className="h-4 w-4 text-primary shrink-0" />
          ) : fileType === 'image' ? (
            <Image className="h-4 w-4 text-muted-foreground shrink-0" />
          ) : (
            <File className="h-4 w-4 text-muted-foreground shrink-0" />
          )}
          <span className="text-sm font-medium truncate">{fileName}</span>
        </div>
        {sessionId && onContinueSession && (
          <Button
            size="sm"
            onClick={() => {
              onContinueSession(sessionId);
              onBack();
            }}
          >
            继续对话
          </Button>
        )}
      </div>

      {isLoading ? (
        <div className="flex-1 flex items-center justify-center">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      ) : error ? (
        <div className="flex-1 flex items-center justify-center text-sm text-muted-foreground">
          {error}
        </div>
      ) : fileType === 'image' ? (
        <div className="flex-1 flex items-center justify-center p-4">
          <div className="text-center text-sm text-muted-foreground">
            <Image className="h-12 w-12 mx-auto mb-2 text-muted-foreground/50" />
            <p>Image preview not available</p>
            <p className="text-xs mt-1">{filePath}</p>
          </div>
        </div>
      ) : fileType === 'markdown' ? (
        <ScrollArea className="flex-1 min-h-0">
          <div className="p-6">
            <MarkdownPreview content={content || ''} />
          </div>
        </ScrollArea>
      ) : fileType === 'text' ? (
        <ScrollArea className="flex-1 min-h-0">
          <pre className="p-6 text-sm font-mono whitespace-pre-wrap break-words">
            {content}
          </pre>
        </ScrollArea>
      ) : (
        <div className="flex-1 flex items-center justify-center text-sm text-muted-foreground">
          <div className="text-center">
            <File className="h-12 w-12 mx-auto mb-2 text-muted-foreground/50" />
            <p>Cannot preview this file type</p>
          </div>
        </div>
      )}
    </div>
  );
}
