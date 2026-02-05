import path from 'path';
import { NextRequest, NextResponse } from 'next/server';
import { checkout, commit as gitCommit } from '@/lib/git';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ canvasId: string }> }
) {
  try {
    const body = await request.json();
    const { versionId, pageId, commitHash } = body;

    if (!versionId) {
      return NextResponse.json(
        { error: 'versionId is required' },
        { status: 400 }
      );
    }

    if (!pageId) {
      return NextResponse.json(
        { error: 'pageId is required' },
        { status: 400 }
      );
    }

    if (!commitHash) {
      return NextResponse.json(
        { error: 'commitHash is required' },
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
    const pageFilePath = `canvas/pages/${pageId}.html`;

    await checkout(versionPath, pageFilePath, commitHash);
    await gitCommit(versionPath, `Revert page ${pageId} to ${commitHash.slice(0, 7)}`);

    await params;

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Failed to revert canvas page:', error);
    const message = error instanceof Error ? error.message : 'Failed to revert';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
