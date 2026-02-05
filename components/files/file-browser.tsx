'use client';

import { useState, useEffect } from 'react';
import {
  FileText,
  Folder,
  FolderOpen,
  Image,
  File,
  ChevronRight,
  ChevronDown,
  Loader2,
  Star,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { ScrollArea } from '@/components/ui/scroll-area';

interface FileEntry {
  name: string;
  path: string;
  type: 'file' | 'directory';
  size?: number;
  mtime?: string;
  isSpecFile?: boolean;
}

interface FileBrowserProps {
  versionId: string;
  onFileSelect: (filePath: string) => void;
  selectedFile?: string;
}

function getFileIcon(entry: FileEntry) {
  if (entry.type === 'directory') {
    return Folder;
  }
  
  const ext = entry.name.split('.').pop()?.toLowerCase();
  switch (ext) {
    case 'md':
      return FileText;
    case 'png':
    case 'jpg':
    case 'jpeg':
    case 'gif':
    case 'svg':
    case 'webp':
      return Image;
    default:
      return File;
  }
}

export function FileBrowser({ versionId, onFileSelect, selectedFile }: FileBrowserProps) {
  const [files, setFiles] = useState<FileEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [expandedDirs, setExpandedDirs] = useState<Set<string>>(
    new Set(['assets', 'references', 'sessions'])
  );

  useEffect(() => {
    async function fetchFiles() {
      setIsLoading(true);
      try {
        const res = await fetch(`/api/files?versionId=${versionId}`);
        if (res.ok) {
          const { data } = await res.json();
          setFiles(data || []);
        }
      } catch (err) {
        console.error('Failed to fetch files:', err);
      } finally {
        setIsLoading(false);
      }
    }

    fetchFiles();
  }, [versionId]);

  const toggleDir = (dirPath: string) => {
    setExpandedDirs((prev) => {
      const next = new Set(prev);
      if (next.has(dirPath)) {
        next.delete(dirPath);
      } else {
        next.add(dirPath);
      }
      return next;
    });
  };

  const renderEntry = (entry: FileEntry, depth: number = 0) => {
    const Icon = getFileIcon(entry);
    const isExpanded = expandedDirs.has(entry.path);
    const isSelected = selectedFile === entry.path;
    const isDirectory = entry.type === 'directory';

    const children = isDirectory
      ? files.filter((f) => {
          const parentPath = f.path.substring(0, f.path.lastIndexOf('/'));
          return parentPath === entry.path;
        })
      : [];

    return (
      <div key={entry.path}>
        <button
          type="button"
          className={cn(
            'flex items-center gap-2 w-full px-2 py-1.5 text-sm rounded-md transition-colors',
            'hover:bg-accent/50',
            isSelected && 'bg-accent text-accent-foreground',
            entry.isSpecFile && 'font-medium'
          )}
          style={{ paddingLeft: `${depth * 12 + 8}px` }}
          onClick={() => {
            if (isDirectory) {
              toggleDir(entry.path);
            } else {
              onFileSelect(entry.path);
            }
          }}
        >
          {isDirectory ? (
            <span className="h-4 w-4 flex items-center justify-center">
              {isExpanded ? (
                <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
              ) : (
                <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
              )}
            </span>
          ) : (
            <span className="h-4 w-4" />
          )}

          {isDirectory && isExpanded ? (
            <FolderOpen className="h-4 w-4 text-amber-500 shrink-0" />
          ) : isDirectory ? (
            <Folder className="h-4 w-4 text-amber-500 shrink-0" />
          ) : (
            <Icon
              className={cn(
                'h-4 w-4 shrink-0',
                entry.isSpecFile ? 'text-primary' : 'text-muted-foreground'
              )}
            />
          )}

          <span className="flex-1 truncate text-left">{entry.name}</span>

          {entry.isSpecFile && (
            <Star className="h-3 w-3 text-amber-500 fill-amber-500" />
          )}
        </button>

        {isDirectory && isExpanded && children.length > 0 && (
          <div>
            {children.map((child) => renderEntry(child, depth + 1))}
          </div>
        )}

        {isDirectory && isExpanded && children.length === 0 && (
          <div
            className="text-xs text-muted-foreground italic px-2 py-1"
            style={{ paddingLeft: `${(depth + 1) * 12 + 28}px` }}
          >
            Empty folder
          </div>
        )}
      </div>
    );
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const rootFiles = files.filter((f) => !f.path.includes('/'));

  return (
    <ScrollArea className="h-full">
      <div className="p-2">
        {rootFiles.map((entry) => renderEntry(entry))}
      </div>
    </ScrollArea>
  );
}
