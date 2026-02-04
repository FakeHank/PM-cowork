import { NextRequest, NextResponse } from 'next/server';
import { getSpecSection } from '@/lib/fs/queries';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ sectionId: string }> }
) {
  const { sectionId } = await params;
  const versionId = request.nextUrl.searchParams.get('versionId');

  if (!versionId) {
    return NextResponse.json(
      { error: 'versionId is required' },
      { status: 400 }
    );
  }

  try {
    const section = await getSpecSection(versionId, sectionId);

    if (!section) {
      return NextResponse.json(
        { error: 'Section not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({ data: section });
  } catch (error) {
    console.error('Failed to fetch spec section:', error);
    return NextResponse.json(
      { error: 'Failed to fetch spec section' },
      { status: 500 }
    );
  }
}
