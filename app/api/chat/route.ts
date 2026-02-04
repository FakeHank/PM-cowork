import { ToolLoopAgent, createAgentUIStreamResponse, stepCountIs } from 'ai';
import { getModel } from '@/lib/ai/config';
import { buildWorkspaceSystemPrompt } from '@/lib/ai/prompts';
import { createWorkspaceTools } from '@/lib/ai/tools';
import { loadAgentContext, createSession, createMessage } from '@/lib/fs/queries';

export const maxDuration = 60;

export async function POST(req: Request) {
  try {
    const { messages, versionId, sessionId } = await req.json();

    if (!versionId) {
      return new Response(
        JSON.stringify({ error: 'versionId is required' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const context = await loadAgentContext(versionId);
    if (!context) {
      return new Response(
        JSON.stringify({ error: 'Version not found' }),
        { status: 404, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const systemPrompt = buildWorkspaceSystemPrompt(context);
    const tools = createWorkspaceTools(versionId);

    let currentSessionId = sessionId;
    if (!currentSessionId) {
      const session = await createSession(versionId);
      currentSessionId = session.id;
    }

    const lastUserMessage = messages[messages.length - 1];
    if (lastUserMessage?.role === 'user') {
      const content = typeof lastUserMessage.content === 'string'
        ? lastUserMessage.content
        : lastUserMessage.parts?.find((p: { type: string }) => p.type === 'text')?.text || '';
      
      if (content) {
        await createMessage(versionId, {
          sessionId: currentSessionId,
          role: 'user',
          content,
        });
      }
    }

    const model = await getModel();
    const agent = new ToolLoopAgent({
      model,
      instructions: systemPrompt,
      tools,
      stopWhen: stepCountIs(10),
    });

    return createAgentUIStreamResponse({
      agent,
      uiMessages: messages,
      headers: {
        'X-Session-Id': currentSessionId,
      },
      onStepFinish: async ({ text }) => {
        if (text) {
          await createMessage(versionId, {
            sessionId: currentSessionId,
            role: 'assistant',
            content: text,
          });
        }
      },
    });
  } catch (error) {
    console.error('Chat API error:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}
