import { ToolLoopAgent, createAgentUIStreamResponse, stepCountIs } from 'ai';
import { getModel } from '@/lib/ai/config';
import { generateSessionTitle } from '@/lib/ai/title';
import { buildWorkspaceSystemPrompt } from '@/lib/ai/prompts';
import { createWorkspaceTools } from '@/lib/ai/tools';
import { loadAgentContext, createSession, createMessage, getSession, updateSessionTitle } from '@/lib/fs/queries';

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
    let currentSessionTitle: string | undefined;
    let createdSession = false;
    if (!currentSessionId) {
      const session = await createSession(versionId);
      currentSessionId = session.id;
      currentSessionTitle = session.title || undefined;
      createdSession = true;
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

    if (!currentSessionTitle) {
      const sessionMeta = createdSession
        ? null
        : await getSession(versionId, currentSessionId);
      currentSessionTitle = sessionMeta?.title || undefined;
    }

    const userContent = lastUserMessage?.role === 'user'
      ? (typeof lastUserMessage.content === 'string'
          ? lastUserMessage.content
          : lastUserMessage.parts?.find((p: { type: string }) => p.type === 'text')?.text || '')
      : '';

    if (!currentSessionTitle && userContent) {
      const title = await generateSessionTitle(userContent);
      currentSessionTitle = title;
      await updateSessionTitle(versionId, currentSessionId, title);
    }

    const model = await getModel();
    const agent = new ToolLoopAgent({
      model,
      instructions: systemPrompt,
      tools,
      stopWhen: stepCountIs(10),
    });

    const responseHeaders: Record<string, string> = {
      'X-Session-Id': currentSessionId,
    };
    if (currentSessionTitle) {
      responseHeaders['X-Session-Title'] = encodeURIComponent(currentSessionTitle);
    }

    return createAgentUIStreamResponse({
      agent,
      uiMessages: messages,
      headers: {
        ...responseHeaders,
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
