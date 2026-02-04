import { NextRequest, NextResponse } from 'next/server';
import { getInboxItem, deleteInboxItem, deleteGlobalInboxItem } from '@/lib/fs/queries';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const projectId = request.nextUrl.searchParams.get('projectId');

  if (!projectId) {
    return NextResponse.json(
      { error: 'projectId is required for GET' },
      { status: 400 }
    );
  }

  try {
    const item = await getInboxItem(projectId, id);
    if (!item) {
      return NextResponse.json({ error: 'Item not found' }, { status: 404 });
    }
    return NextResponse.json({ data: item });
  } catch (error) {
    console.error('Failed to fetch inbox item:', error);
    return NextResponse.json(
      { error: 'Failed to fetch inbox item' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const projectId = request.nextUrl.searchParams.get('projectId');

  try {
    let success: boolean;
    
    if (projectId) {
      success = await deleteInboxItem(projectId, id);
    } else {
      success = await deleteGlobalInboxItem(id);
    }
    
    if (!success) {
      return NextResponse.json({ error: 'Item not found' }, { status: 404 });
    }
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Failed to delete inbox item:', error);
    return NextResponse.json(
      { error: 'Failed to delete inbox item' },
      { status: 500 }
    );
  }
}
