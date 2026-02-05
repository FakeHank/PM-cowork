import { streamText } from 'ai';
import { getModel } from '@/lib/ai/config';
import { CANVAS_GENERATE_SYSTEM_PROMPT } from '@/lib/ai/prompts';
import { addCanvasPage, canvasExists, createCanvas } from '@/lib/fs/canvas';

export const maxDuration = 60;

export async function POST(req: Request) {
  try {
    const { versionId, pageName, specContent, userPrompt } = await req.json();

    if (!versionId) {
      return new Response(
        JSON.stringify({ error: 'versionId is required' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    if (!pageName) {
      return new Response(
        JSON.stringify({ error: 'pageName is required' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    if (!(await canvasExists(versionId))) {
      await createCanvas(versionId, 'Canvas');
    }

    const userMessage = buildGeneratePrompt(specContent, userPrompt);
    const model = await getModel();

    const result = streamText({
      model,
      system: CANVAS_GENERATE_SYSTEM_PROMPT,
      messages: [{ role: 'user', content: userMessage }],
      async onFinish({ text }) {
        try {
          const htmlContent = extractHtmlContent(text);
          await addCanvasPage(versionId, pageName, htmlContent);
        } catch (error) {
          console.error('Failed to save canvas page:', error);
        }
      },
    });

    return result.toTextStreamResponse();
  } catch (error) {
    console.error('Canvas generate API error:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}

function buildGeneratePrompt(specContent?: string, userPrompt?: string): string {
  const parts: string[] = [];

  if (specContent) {
    parts.push(`## Product Spec\n${specContent}`);
  }

  if (userPrompt) {
    parts.push(`## User Request\n${userPrompt}`);
  }

  if (parts.length === 0) {
    parts.push('Create a simple landing page with a hero section and feature cards.');
  }

  return parts.join('\n\n');
}

function extractHtmlContent(text: string): string {
  const docTypeMatch = text.match(/<!DOCTYPE html>[\s\S]*/i);
  if (docTypeMatch) {
    return docTypeMatch[0].trim();
  }

  const htmlMatch = text.match(/<html[\s\S]*<\/html>/i);
  if (htmlMatch) {
    return `<!DOCTYPE html>\n${htmlMatch[0]}`;
  }

  return text.trim();
}
