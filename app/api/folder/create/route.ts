import { NextRequest, NextResponse } from 'next/server';
import path from 'path';
import { promises as fs } from 'fs';
import { exists } from '@/lib/fs';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const parentPath = typeof body?.parentPath === 'string' ? body.parentPath : '';
    const name = typeof body?.name === 'string' ? body.name.trim() : '';

    if (!parentPath || !name) {
      return NextResponse.json(
        { error: 'parentPath and name are required' },
        { status: 400 }
      );
    }

    if (name === '.' || name === '..' || name.includes('/') || name.includes('\\')) {
      return NextResponse.json(
        { error: 'Invalid folder name' },
        { status: 400 }
      );
    }

    const normalizedParent = path.resolve(parentPath);
    if (!(await exists(normalizedParent))) {
      return NextResponse.json(
        { error: 'Parent directory does not exist' },
        { status: 404 }
      );
    }

    const parentStats = await fs.stat(normalizedParent);
    if (!parentStats.isDirectory()) {
      return NextResponse.json(
        { error: 'Parent path is not a directory' },
        { status: 400 }
      );
    }

    const newPath = path.resolve(path.join(normalizedParent, name));
    if (!newPath.startsWith(normalizedParent)) {
      return NextResponse.json(
        { error: 'Invalid folder path' },
        { status: 400 }
      );
    }

    if (await exists(newPath)) {
      return NextResponse.json(
        { error: 'Folder already exists' },
        { status: 409 }
      );
    }

    await fs.mkdir(newPath, { recursive: false });

    return NextResponse.json({
      data: { path: newPath, name },
    });
  } catch (error) {
    console.error('Error creating folder:', error);
    return NextResponse.json(
      { error: 'Failed to create folder' },
      { status: 500 }
    );
  }
}
