import { generateText } from 'ai';
import { getModel } from '@/lib/ai/config';

const TITLE_SYSTEM_PROMPT = `你是一个对话标题生成助手。
根据用户输入生成一个简短、清晰的标题。
要求：
1) 不要使用引号或句号
2) 12个中文字符以内，或 8 个英文单词以内
3) 只输出标题本身`;

function sanitizeTitle(title: string): string {
  let cleaned = title.trim();
  cleaned = cleaned.replace(/^["'“”‘’]+|["'“”‘’]+$/g, '');
  cleaned = cleaned.replace(/[\r\n]+/g, ' ').trim();
  cleaned = cleaned.replace(/[。！!？?]$/g, '').trim();
  return cleaned;
}

function fallbackTitle(input: string): string {
  const trimmed = input.trim().replace(/\s+/g, ' ');
  if (!trimmed) return '新对话';
  return trimmed.length > 24 ? `${trimmed.slice(0, 24)}...` : trimmed;
}

export async function generateSessionTitle(input: string): Promise<string> {
  const prompt = input.trim();
  if (!prompt) return '新对话';

  try {
    const model = await getModel();
    const { text } = await generateText({
      model,
      system: TITLE_SYSTEM_PROMPT,
      prompt,
      temperature: 0.2,
      maxOutputTokens: 32,
    });

    const sanitized = sanitizeTitle(text);
    return sanitized || fallbackTitle(prompt);
  } catch {
    return fallbackTitle(prompt);
  }
}
