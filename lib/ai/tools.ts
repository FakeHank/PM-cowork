import { tool, zodSchema } from 'ai';
import { z } from 'zod';
import {
  getSpec,
  updateSpec,
  getSpecOutline,
  searchInbox,
} from '@/lib/fs/queries';

export function createWorkspaceTools(versionId: string) {
  const projectId = versionId.split('/')[0];

  return {
    getSpecOutline: tool({
      description: '获取 spec.md 文档的章节大纲，了解文档结构',
      inputSchema: zodSchema(z.object({})),
      execute: async () => {
        const outline = await getSpecOutline(versionId);
        if (outline.length === 0) {
          return { outline: [] as const, message: 'spec.md 文档暂无内容' };
        }
        return {
          outline: outline.map((s) => ({
            id: s.id,
            title: s.title,
            depth: s.depth,
          })),
        };
      },
    }),

    readSpec: tool({
      description: '读取完整的 spec.md 文档内容',
      inputSchema: zodSchema(z.object({})),
      execute: async () => {
        const content = await getSpec(versionId);
        if (!content) {
          return { content: '', message: 'spec.md 文档为空' };
        }
        return { content };
      },
    }),

    updateSpec: tool({
      description: '更新 spec.md 文档的完整内容。请先用 readSpec 读取当前内容，然后修改后提交。',
      inputSchema: zodSchema(z.object({
        content: z.string().describe('新的文档内容（Markdown 格式）'),
        reason: z.string().describe('修改原因'),
      })),
      execute: async ({ content, reason }) => {
        const success = await updateSpec(versionId, content);
        if (!success) {
          return { error: '更新失败' };
        }
        return {
          success: true,
          reason,
          message: '已更新 spec.md',
        };
      },
    }),

    appendToSpec: tool({
      description: '在 spec.md 文档末尾追加内容',
      inputSchema: zodSchema(z.object({
        content: z.string().describe('要追加的内容（Markdown 格式）'),
        reason: z.string().describe('追加原因'),
      })),
      execute: async ({ content, reason }) => {
        const currentContent = await getSpec(versionId);
        const newContent = currentContent ? `${currentContent}\n\n${content}` : content;
        const success = await updateSpec(versionId, newContent);
        if (!success) {
          return { error: '追加失败' };
        }
        return {
          success: true,
          reason,
          message: '已追加内容到 spec.md',
        };
      },
    }),

    updateSpecSection: tool({
      description: '更新 spec.md 中的指定章节。根据章节标题定位并替换内容。',
      inputSchema: zodSchema(z.object({
        sectionTitle: z.string().describe('章节标题（不含 # 符号）'),
        newContent: z.string().describe('新的章节内容（包含标题行）'),
        reason: z.string().describe('修改原因'),
      })),
      execute: async ({ sectionTitle, newContent, reason }) => {
        const currentContent = await getSpec(versionId);
        if (!currentContent) {
          return { error: 'spec.md 为空' };
        }

        const lines = currentContent.split('\n');
        const headerPattern = new RegExp(`^(#{1,6})\\s+${escapeRegex(sectionTitle)}\\s*$`);
        
        let startIndex = -1;
        let endIndex = lines.length;
        let headerLevel = 0;

        for (let i = 0; i < lines.length; i++) {
          const match = lines[i].match(headerPattern);
          if (match && startIndex === -1) {
            startIndex = i;
            headerLevel = match[1].length;
            continue;
          }
          
          if (startIndex !== -1) {
            const headerMatch = lines[i].match(/^(#{1,6})\s/);
            if (headerMatch && headerMatch[1].length <= headerLevel) {
              endIndex = i;
              break;
            }
          }
        }

        if (startIndex === -1) {
          return { error: `未找到章节「${sectionTitle}」` };
        }

        const newLines = [
          ...lines.slice(0, startIndex),
          newContent.trim(),
          ...lines.slice(endIndex),
        ];

        const success = await updateSpec(versionId, newLines.join('\n'));
        if (!success) {
          return { error: '更新失败' };
        }

        return {
          success: true,
          sectionTitle,
          reason,
          message: `已更新章节「${sectionTitle}」`,
        };
      },
    }),

    searchInbox: tool({
      description: '从 Inbox 中搜索相关的碎片信息（用户反馈、竞品分析、产品想法等）',
      inputSchema: zodSchema(z.object({
        query: z.string().describe('搜索关键词'),
        limit: z.number().optional().default(5).describe('返回结果数量'),
      })),
      execute: async ({ query, limit }) => {
        if (!projectId) {
          return { results: [] as const, message: '无法确定项目' };
        }
        const items = await searchInbox(projectId, query, limit ?? 5);
        if (items.length === 0) {
          return { results: [] as const, message: `未找到与「${query}」相关的内容` };
        }
        return {
          results: items.map((item) => ({
            id: item.id,
            content: item.content.slice(0, 500),
            createdAt: item.createdAt,
          })),
          message: `找到 ${items.length} 条相关内容`,
        };
      },
    }),
  };
}

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export type WorkspaceTools = ReturnType<typeof createWorkspaceTools>;
