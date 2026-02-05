import { NextResponse } from 'next/server';
import { MARKDOWN_CSS_FILE, readText, writeText } from '@/lib/fs';

export async function GET() {
  const css = (await readText(MARKDOWN_CSS_FILE)) ?? '';
  return NextResponse.json({ data: { css } });
}

export async function PUT(request: Request) {
  try {
    const body = await request.json();
    const css = typeof body?.css === 'string' ? body.css : null;

    if (css === null) {
      return NextResponse.json(
        { error: 'Invalid css payload' },
        { status: 400 }
      );
    }

    await writeText(MARKDOWN_CSS_FILE, css);
    return NextResponse.json({ data: { css } });
  } catch {
    return NextResponse.json(
      { error: 'Failed to save css' },
      { status: 500 }
    );
  }
}
