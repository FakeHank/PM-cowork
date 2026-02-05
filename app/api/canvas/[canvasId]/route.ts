import { NextRequest, NextResponse } from 'next/server';
import { getCanvasById } from '@/lib/fs/canvas';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ canvasId: string }> }
) {
  try {
    const { canvasId } = await params;

    if (!canvasId) {
      return NextResponse.json(
        { error: 'canvasId is required' },
        { status: 400 }
      );
    }

    const canvas = await getCanvasById(canvasId);

    if (!canvas) {
      return NextResponse.json(
        { error: 'Canvas not found' },
        { status: 404 }
      );
    }

    return NextResponse.json(canvas);
  } catch (error) {
    console.error('Failed to fetch canvas:', error instanceof Error ? error.stack : error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch canvas' },
      { status: 500 }
    );
  }
}
