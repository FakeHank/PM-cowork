import { NextRequest, NextResponse } from 'next/server';
import { 
  getInboxItems, 
  createInboxItem, 
  getGlobalInboxItems, 
  createGlobalInboxItem 
} from '@/lib/fs/queries';

export async function GET(request: NextRequest) {
  const projectId = request.nextUrl.searchParams.get('projectId');
  const search = request.nextUrl.searchParams.get('search') || undefined;
  const limit = parseInt(request.nextUrl.searchParams.get('limit') || '20');

  try {
    if (projectId) {
      const result = await getInboxItems(projectId, { search, limit });
      return NextResponse.json({ data: result.items, nextCursor: result.nextCursor });
    } else {
      const result = await getGlobalInboxItems({ search, limit });
      return NextResponse.json({ data: result.items, nextCursor: result.nextCursor });
    }
  } catch (error) {
    console.error('Failed to fetch inbox items:', error);
    return NextResponse.json(
      { error: 'Failed to fetch inbox items' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { projectId, content, title } = body;

    if (!content) {
      return NextResponse.json(
        { error: 'content is required' },
        { status: 400 }
      );
    }

    if (projectId) {
      const item = await createInboxItem(projectId, { content, title });
      return NextResponse.json({ data: item }, { status: 201 });
    } else {
      const item = await createGlobalInboxItem({ content, title });
      return NextResponse.json({ data: item }, { status: 201 });
    }
  } catch (error) {
    console.error('Failed to create inbox item:', error);
    return NextResponse.json(
      { error: 'Failed to create inbox item' },
      { status: 500 }
    );
  }
}
