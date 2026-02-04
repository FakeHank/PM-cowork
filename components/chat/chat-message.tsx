'use client';

import { Bot, User } from 'lucide-react';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { cn } from '@/lib/utils';
import { ToolInvocation } from './tool-invocation';
import type { UIMessage, UIMessagePart, UIDataTypes, UITools } from 'ai';
import { isToolUIPart, isTextUIPart, getToolName } from 'ai';

interface ChatMessageProps {
  message: UIMessage;
}

function getToolCallId(part: UIMessagePart<UIDataTypes, UITools>): string {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (part as any).toolCallId ?? '';
}

function getToolInput(part: UIMessagePart<UIDataTypes, UITools>): Record<string, unknown> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const p = part as any;
  return p.input ?? p.args ?? {};
}

function getToolOutput(part: UIMessagePart<UIDataTypes, UITools>): unknown {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const p = part as any;
  return p.output ?? p.result;
}

function getToolState(part: UIMessagePart<UIDataTypes, UITools>): 'pending' | 'result' {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const state = (part as any).state;
  return state === 'output-available' || state === 'result' ? 'result' : 'pending';
}

export function ChatMessage({ message }: ChatMessageProps) {
  const isUser = message.role === 'user';

  const textContent = message.parts
    .filter(isTextUIPart)
    .map((p) => p.text)
    .join('');

  const toolParts = message.parts.filter(isToolUIPart);

  return (
    <div className={cn('flex gap-3', isUser && 'flex-row-reverse')}>
      <Avatar className="h-8 w-8 shrink-0">
        <AvatarFallback
          className={cn(
            isUser ? 'bg-muted' : 'bg-primary text-primary-foreground'
          )}
        >
          {isUser ? <User className="h-4 w-4" /> : <Bot className="h-4 w-4" />}
        </AvatarFallback>
      </Avatar>

      <div className={cn('flex-1 space-y-2', isUser && 'flex flex-col items-end')}>
        {toolParts.map((toolPart) => (
          <ToolInvocation
            key={getToolCallId(toolPart)}
            toolName={getToolName(toolPart)}
            args={getToolInput(toolPart)}
            result={getToolOutput(toolPart)}
            state={getToolState(toolPart)}
          />
        ))}

        {textContent && (
          <div
            className={cn(
              'rounded-lg px-4 py-3 max-w-[85%]',
              isUser ? 'bg-primary text-primary-foreground' : 'bg-muted'
            )}
          >
            <div className="text-sm whitespace-pre-wrap">{textContent}</div>
          </div>
        )}
      </div>
    </div>
  );
}
