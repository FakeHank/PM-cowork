import { NextRequest, NextResponse } from 'next/server';
import { getVersionsByProject, createVersion } from '@/lib/fs/queries';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ projectId: string }> }
) {
  const { projectId } = await params;

  try {
    const versions = await getVersionsByProject(projectId);
    return NextResponse.json({ data: versions });
  } catch (error) {
    console.error('Failed to fetch versions:', error);
    return NextResponse.json(
      { error: 'Failed to fetch versions' },
      { status: 500 }
    );
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ projectId: string }> }
) {
  const { projectId } = await params;

  try {
    const body = await request.json();
    const { name } = body;

    if (!name) {
      return NextResponse.json(
        { error: 'name is required' },
        { status: 400 }
      );
    }

    const version = await createVersion({ projectId, name });
    return NextResponse.json({ data: version }, { status: 201 });
  } catch (error) {
    console.error('Failed to create version:', error);
    const message = error instanceof Error ? error.message : 'Failed to create version';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
