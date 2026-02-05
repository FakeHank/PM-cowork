import path from 'path';
import { NextRequest, NextResponse } from 'next/server';
import { log as gitLog } from '@/lib/git';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ canvasId: string }> }
) {
  try {
    const { searchParams } = new URL(request.url);
    const versionId = searchParams.get('versionId');

    if (!versionId) {
      return NextResponse.json(
        { error: 'versionId query parameter is required' },
        { status: 400 }
      );
    }

    const [projectId, versionFolder] = versionId.split('/');
    if (!projectId || !versionFolder) {
      return NextResponse.json(
        { error: 'Invalid versionId format. Expected: projectId/versionFolder' },
        { status: 400 }
      );
    }

    const versionPath = path.join(process.cwd(), 'projects', projectId, 'versions', versionFolder);
    
    const limitParam = searchParams.get('limit');
    const limit = limitParam ? parseInt(limitParam, 10) : 50;

    const commits = await gitLog(versionPath, limit);
    
    await params;

    return NextResponse.json({ data: commits });
  } catch (error) {
    console.error('Failed to fetch canvas history:', error);
    const message = error instanceof Error ? error.message : 'Failed to fetch history';
    
    if (message.includes('Not a git repository')) {
      return NextResponse.json({ data: [] });
    }
    
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
