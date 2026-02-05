'use client';

import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import type { Components } from 'react-markdown';
import { cn } from '@/lib/utils';
import { useSettingsStore } from '@/stores/app-store';
import { DEFAULT_MARKDOWN_SETTINGS } from '@/lib/types';

interface MarkdownPreviewProps {
  content: string;
  className?: string;
}

const markdownComponents: Components = {
  a: ({ children, node, ...props }) => (
    <a
      target="_blank"
      rel="noreferrer"
      {...props}
    >
      {children}
    </a>
  ),
  pre: ({ children, node, ...props }) => (
    <pre className="markdown-pre" {...props}>
      {children}
    </pre>
  ),
  code: ({ inline, className, children, node, ...props }) => {
    const text = String(children).replace(/\n$/, '');
    if (inline) {
      return (
        <code
          className={cn('markdown-inline-code', className)}
          {...props}
        >
          {text}
        </code>
      );
    }
    return (
      <code className={cn('markdown-code', className)} {...props}>
        {text}
      </code>
    );
  },
  table: ({ children, node, ...props }) => (
    <div className="markdown-table">
      <table {...props}>
        {children}
      </table>
    </div>
  ),
  img: ({ node, ...props }) => <img className="markdown-image" {...props} />,
  input: ({ node, ...props }) => (
    <input className="markdown-checkbox" {...props} />
  ),
};

export function MarkdownPreview({ content, className }: MarkdownPreviewProps) {
  const markdownSettings = useSettingsStore((state) => state.settings.markdown);
  const style = markdownSettings?.style ?? DEFAULT_MARKDOWN_SETTINGS.style;
  const fontSize = markdownSettings?.fontSize ?? DEFAULT_MARKDOWN_SETTINGS.fontSize;

  return (
    <div
      className={cn(
        'markdown-preview',
        `markdown-preview--style-${style}`,
        `markdown-preview--size-${fontSize}`,
        className
      )}
    >
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={markdownComponents}>
        {content}
      </ReactMarkdown>
    </div>
  );
}
