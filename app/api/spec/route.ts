import { NextRequest, NextResponse } from 'next/server';
import { getSpec, updateSpec, getSpecOutline } from '@/lib/fs/queries';

export async function GET(request: NextRequest) {
  const versionId = request.nextUrl.searchParams.get('versionId');
  const outline = request.nextUrl.searchParams.get('outline') === 'true';

  if (!versionId) {
    return NextResponse.json(
      { error: 'versionId is required' },
      { status: 400 }
    );
  }

  try {
    if (outline) {
      const data = await getSpecOutline(versionId);
      return NextResponse.json({ data });
    }
    
    const content = await getSpec(versionId);
    return NextResponse.json({ data: { content } });
  } catch (error) {
    console.error('Failed to fetch spec:', error);
    return NextResponse.json(
      { error: 'Failed to fetch spec' },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest) {
  const versionId = request.nextUrl.searchParams.get('versionId');

  if (!versionId) {
    return NextResponse.json(
      { error: 'versionId is required' },
      { status: 400 }
    );
  }

  try {
    const body = await request.json();
    const { content } = body;

    if (content === undefined) {
      return NextResponse.json(
        { error: 'content is required' },
        { status: 400 }
      );
    }

    const success = await updateSpec(versionId, content);
    if (!success) {
      return NextResponse.json(
        { error: 'Failed to update spec' },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Failed to update spec:', error);
    return NextResponse.json(
      { error: 'Failed to update spec' },
      { status: 500 }
    );
  }
}
