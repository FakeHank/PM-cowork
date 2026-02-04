'use client';

import { useState } from 'react';
import { ChevronDown, ChevronRight, Wrench, Check, Loader2, AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ToolInvocationProps {
  toolName: string;
  args: Record<string, unknown>;
  result?: unknown;
  state: 'pending' | 'result' | 'error';
}

const toolLabels: Record<string, string> = {
  getSpecOutline: '获取文档大纲',
  readSpecSection: '读取章节内容',
  updateSpecSection: '更新章节',
  createSpecSection: '创建新章节',
  searchInbox: '搜索 Inbox',
  getProjectContext: '获取项目上下文',
  markSectionComplete: '标记完成',
};

export function ToolInvocation({ toolName, args, result, state }: ToolInvocationProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const label = toolLabels[toolName] || toolName;

  return (
    <div className="my-2 rounded-lg border bg-muted/30 text-sm">
      <button
        type="button"
        onClick={() => setIsExpanded(!isExpanded)}
        className="flex w-full items-center gap-2 px-3 py-2 hover:bg-muted/50 transition-colors"
      >
        {isExpanded ? (
          <ChevronDown className="h-3 w-3 text-muted-foreground" />
        ) : (
          <ChevronRight className="h-3 w-3 text-muted-foreground" />
        )}
        <Wrench className="h-3 w-3 text-muted-foreground" />
        <span className="font-medium">{label}</span>
        <div className="ml-auto">
          {state === 'pending' && (
            <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />
          )}
          {state === 'result' && (
            <Check className="h-3 w-3 text-green-600" />
          )}
          {state === 'error' && (
            <AlertCircle className="h-3 w-3 text-red-500" />
          )}
        </div>
      </button>

      {isExpanded && (
        <div className="border-t px-3 py-2 space-y-2">
          {Object.keys(args).length > 0 && (
            <div>
              <div className="text-xs font-medium text-muted-foreground mb-1">参数</div>
              <pre className="text-xs bg-background rounded p-2 overflow-x-auto">
                {JSON.stringify(args, null, 2)}
              </pre>
            </div>
          )}
          {result !== undefined && (
            <div>
              <div className="text-xs font-medium text-muted-foreground mb-1">结果</div>
              <pre className={cn(
                "text-xs rounded p-2 overflow-x-auto max-h-40",
                state === 'error' ? 'bg-red-50 text-red-800' : 'bg-background'
              )}>
                {typeof result === 'string' ? result : JSON.stringify(result, null, 2)}
              </pre>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
