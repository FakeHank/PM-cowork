import { NextRequest, NextResponse } from 'next/server';
import { generateSessionTitle } from '@/lib/ai/title';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const text = typeof body?.text === 'string' ? body.text.trim() : '';

    if (!text) {
      return NextResponse.json(
        { error: 'text is required' },
        { status: 400 }
      );
    }

    const title = await generateSessionTitle(text);

    return NextResponse.json({
      data: { title },
    });
  } catch (error) {
    console.error('Failed to generate title:', error);
    return NextResponse.json(
      { error: 'Failed to generate title' },
      { status: 500 }
    );
  }
}
