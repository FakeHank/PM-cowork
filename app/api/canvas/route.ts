import { NextRequest, NextResponse } from 'next/server';
import { getCanvas, createCanvas } from '@/lib/fs/canvas';

/**
 * GET /api/canvas?versionId=xxx
 * Get canvas data for a version
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const versionId = searchParams.get('versionId');

    if (!versionId) {
      return NextResponse.json(
        { error: 'versionId is required' },
        { status: 400 }
      );
    }

    const canvas = await getCanvas(versionId);
    
    if (!canvas) {
      return NextResponse.json({ data: null });
    }

    return NextResponse.json({ data: canvas });
  } catch (error) {
    console.error('Failed to fetch canvas:', error);
    return NextResponse.json(
      { error: 'Failed to fetch canvas' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/canvas
 * Create a new canvas for a version
 * Body: { versionId: string, name: string }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { versionId, name } = body;

    if (!versionId) {
      return NextResponse.json(
        { error: 'versionId is required' },
        { status: 400 }
      );
    }

    if (!name) {
      return NextResponse.json(
        { error: 'name is required' },
        { status: 400 }
      );
    }

    const canvas = await createCanvas(versionId, name);
    return NextResponse.json({ data: canvas }, { status: 201 });
  } catch (error) {
    console.error('Failed to create canvas:', error);
    const message = error instanceof Error ? error.message : 'Failed to create canvas';
    
    if (message.includes('already exists')) {
      return NextResponse.json({ error: message }, { status: 409 });
    }
    
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
