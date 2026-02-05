import { runWorkflowPipeline } from '@/lib/ai/workflow/pipeline';
import type { WorkflowEvent } from '@/lib/ai/workflow/types';

export const maxDuration = 300;

export async function POST(req: Request) {
  try {
    const { versionId } = await req.json();

    if (!versionId) {
      return new Response(
        JSON.stringify({ error: 'versionId is required' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const signal = req.signal;
    const encoder = new TextEncoder();

    const stream = new ReadableStream({
      start(controller) {
        const onEvent = (event: WorkflowEvent) => {
          const data = `event: ${event.event}\ndata: ${JSON.stringify(event)}\n\n`;
          controller.enqueue(encoder.encode(data));
        };

        runWorkflowPipeline(versionId, signal, onEvent)
          .then(() => {
            controller.close();
          })
          .catch((error: unknown) => {
            const errorMessage =
              error instanceof Error ? error.message : 'Unknown error';
            const errorEvent = `event: error\ndata: ${JSON.stringify({ event: 'error', error: errorMessage })}\n\n`;
            controller.enqueue(encoder.encode(errorEvent));
            controller.close();
          });
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
    console.error('Canvas workflow API error:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}
