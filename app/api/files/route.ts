import { NextRequest, NextResponse } from 'next/server';
import { listVersionFiles, readVersionFile } from '@/lib/fs/files';

export async function GET(request: NextRequest) {
  const versionId = request.nextUrl.searchParams.get('versionId');
  const filePath = request.nextUrl.searchParams.get('path');

  if (!versionId) {
    return NextResponse.json(
      { error: 'versionId is required' },
      { status: 400 }
    );
  }

  try {
    if (filePath) {
      const content = await readVersionFile(versionId, filePath);
      if (content === null) {
        return NextResponse.json(
          { error: 'File not found' },
          { status: 404 }
        );
      }
      return NextResponse.json({ data: { content, path: filePath } });
    }

    const files = await listVersionFiles(versionId);
    return NextResponse.json({ data: files });
  } catch (error) {
    console.error('Failed to fetch files:', error);
    return NextResponse.json(
      { error: 'Failed to fetch files' },
      { status: 500 }
    );
  }
}
