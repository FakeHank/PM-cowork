import { streamText } from 'ai';
import { getModel } from '@/lib/ai/config';
import { CANVAS_ITERATE_SYSTEM_PROMPT } from '@/lib/ai/prompts';
import { saveCanvasPage } from '@/lib/fs/canvas';

export const maxDuration = 60;

interface IterateEvent {
  event: 'status' | 'done' | 'error';
  message: string;
}

function sseEncode(event: IterateEvent): string {
  return `event: ${event.event}\ndata: ${JSON.stringify(event)}\n\n`;
}

export async function POST(req: Request) {
  try {
    const { versionId, pageId, currentHtml, userPrompt } = await req.json();

    if (!versionId) {
      return new Response(
        JSON.stringify({ error: 'versionId is required' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    if (!pageId) {
      return new Response(
        JSON.stringify({ error: 'pageId is required' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    if (!currentHtml) {
      return new Response(
        JSON.stringify({ error: 'currentHtml is required' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    if (!userPrompt) {
      return new Response(
        JSON.stringify({ error: 'userPrompt is required' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const encoder = new TextEncoder();

    const stream = new ReadableStream({
      start(controller) {
        const emit = (event: IterateEvent) => {
          controller.enqueue(encoder.encode(sseEncode(event)));
        };

        (async () => {
          try {
            emit({ event: 'status', message: 'Analyzing your request...' });

            const userMessage = buildIteratePrompt(currentHtml, userPrompt);
            const model = await getModel();

            emit({ event: 'status', message: 'Generating updated HTML...' });

            const result = streamText({
              model,
              system: CANVAS_ITERATE_SYSTEM_PROMPT,
              messages: [{ role: 'user', content: userMessage }],
            });

            const text = await result.text;

            emit({ event: 'status', message: 'Saving changes...' });

            const htmlContent = extractHtmlContent(text);
            const commitMessage = `Canvas update: ${userPrompt.slice(0, 50)}${userPrompt.length > 50 ? '...' : ''}`;
            await saveCanvasPage(versionId, pageId, htmlContent, commitMessage);

            emit({ event: 'done', message: 'Canvas updated.' });
            controller.close();
          } catch (error) {
            const message = error instanceof Error ? error.message : 'Something went wrong';
            emit({ event: 'error', message });
            controller.close();
          }
        })();
      },
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
      },
    });
  } catch (error) {
    console.error('Canvas iterate API error:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}

function buildIteratePrompt(currentHtml: string, userPrompt: string): string {
  return `## Current HTML\n\`\`\`html\n${currentHtml}\n\`\`\`\n\n## Modification Request\n${userPrompt}`;
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
