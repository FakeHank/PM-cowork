'use client';

import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import type { Components } from 'react-markdown';
import { cn } from '@/lib/utils';

interface ChatMarkdownProps {
  content: string;
  className?: string;
}

const markdownComponents: Components = {
  h1: ({ children, node, ...props }) => (
    <h1 className="text-lg font-semibold leading-snug" {...props}>
      {children}
    </h1>
  ),
  h2: ({ children, node, ...props }) => (
    <h2 className="text-base font-semibold leading-snug" {...props}>
      {children}
    </h2>
  ),
  h3: ({ children, node, ...props }) => (
    <h3 className="text-sm font-semibold leading-snug" {...props}>
      {children}
    </h3>
  ),
  h4: ({ children, node, ...props }) => (
    <h4 className="text-sm font-semibold leading-snug" {...props}>
      {children}
    </h4>
  ),
  p: ({ children, node, ...props }) => (
    <p className="leading-relaxed" {...props}>
      {children}
    </p>
  ),
  ul: ({ children, node, ...props }) => (
    <ul className="list-disc pl-5 space-y-1" {...props}>
      {children}
    </ul>
  ),
  ol: ({ children, node, ...props }) => (
    <ol className="list-decimal pl-5 space-y-1" {...props}>
      {children}
    </ol>
  ),
  li: ({ children, node, ...props }) => (
    <li className="leading-relaxed" {...props}>
      {children}
    </li>
  ),
  a: ({ children, node, ...props }) => (
    <a
      className="text-primary underline underline-offset-4"
      target="_blank"
      rel="noreferrer"
      {...props}
    >
      {children}
    </a>
  ),
  blockquote: ({ children, node, ...props }) => (
    <blockquote
      className="border-l-2 border-muted-foreground/30 pl-3 italic text-muted-foreground"
      {...props}
    >
      {children}
    </blockquote>
  ),
  pre: ({ children, node, ...props }) => (
    <pre
      className="overflow-x-auto rounded-md bg-muted/60 p-3 text-xs leading-relaxed whitespace-pre"
      {...props}
    >
      {children}
    </pre>
  ),
  code: ({ inline, className, children, node, ...props }) => {
    const codeText = String(children).replace(/\n$/, '');
    if (inline) {
      return (
        <code
          className="rounded bg-muted px-1 py-0.5 font-mono text-xs"
          {...props}
        >
          {codeText}
        </code>
      );
    }
    return (
      <code className={cn('block font-mono text-xs', className)} {...props}>
        {codeText}
      </code>
    );
  },
  hr: ({ node, ...props }) => <hr className="border-border" {...props} />,
  table: ({ children, node, ...props }) => (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse text-xs" {...props}>
        {children}
      </table>
    </div>
  ),
  th: ({ children, node, ...props }) => (
    <th className="border border-border bg-muted/50 px-2 py-1 text-left font-medium" {...props}>
      {children}
    </th>
  ),
  td: ({ children, node, ...props }) => (
    <td className="border border-border px-2 py-1 align-top" {...props}>
      {children}
    </td>
  ),
  img: ({ node, ...props }) => <img className="max-w-full rounded-md" {...props} />,
};

export function ChatMarkdown({ content, className }: ChatMarkdownProps) {
  return (
    <div className={cn('text-sm leading-relaxed space-y-3 break-words', className)}>
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={markdownComponents}>
        {content}
      </ReactMarkdown>
    </div>
  );
}
