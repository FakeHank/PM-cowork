import { NextResponse } from 'next/server';
import { getMessagesBySession, getSession } from '@/lib/fs/queries';

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const versionId = searchParams.get('versionId');
    const sessionId = searchParams.get('sessionId');

    if (!versionId || !sessionId) {
      return NextResponse.json(
        { error: 'versionId and sessionId are required' },
        { status: 400 }
      );
    }

    const [messages, session] = await Promise.all([
      getMessagesBySession(versionId, sessionId),
      getSession(versionId, sessionId),
    ]);

    return NextResponse.json({
      data: { sessionId, messages, session },
    });
  } catch (error) {
    console.error('Failed to load session messages:', error);
    return NextResponse.json(
      { error: 'Failed to load session messages' },
      { status: 500 }
    );
  }
}
