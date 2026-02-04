import { NextRequest, NextResponse } from 'next/server';
import { getVersion, updateVersion, deleteVersion } from '@/lib/fs/queries';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ projectId: string; versionId: string }> }
) {
  const { projectId, versionId } = await params;
  const fullVersionId = `${projectId}/${versionId}`;

  try {
    const version = await getVersion(fullVersionId);
    if (!version) {
      return NextResponse.json({ error: 'Version not found' }, { status: 404 });
    }
    return NextResponse.json({ data: version });
  } catch (error) {
    console.error('Failed to fetch version:', error);
    return NextResponse.json(
      { error: 'Failed to fetch version' },
      { status: 500 }
    );
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ projectId: string; versionId: string }> }
) {
  const { projectId, versionId } = await params;
  const fullVersionId = `${projectId}/${versionId}`;

  try {
    const body = await request.json();
    const { name, status } = body;

    const version = await updateVersion(fullVersionId, { name, status });
    if (!version) {
      return NextResponse.json({ error: 'Version not found' }, { status: 404 });
    }
    return NextResponse.json({ data: version });
  } catch (error) {
    console.error('Failed to update version:', error);
    return NextResponse.json(
      { error: 'Failed to update version' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ projectId: string; versionId: string }> }
) {
  const { projectId, versionId } = await params;
  const fullVersionId = `${projectId}/${versionId}`;

  try {
    const success = await deleteVersion(fullVersionId);
    if (!success) {
      return NextResponse.json({ error: 'Version not found' }, { status: 404 });
    }
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Failed to delete version:', error);
    return NextResponse.json(
      { error: 'Failed to delete version' },
      { status: 500 }
    );
  }
}
