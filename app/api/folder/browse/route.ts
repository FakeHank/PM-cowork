import { NextRequest, NextResponse } from 'next/server';
import { promises as fs } from 'fs';
import path from 'path';
import os from 'os';
import { exists, readJson } from '@/lib/fs';
import type { ProjectMeta, VersionMeta } from '@/lib/fs/types';

export interface DirectoryItem {
  name: string;
  path: string;
  type: 'directory' | 'project' | 'version';
  projectName?: string;
  versionName?: string;
}

export interface BrowseResult {
  currentPath: string;
  parentPath: string | null;
  items: DirectoryItem[];
}

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    let dirPath = searchParams.get('path');

    if (!dirPath) {
      dirPath = os.homedir();
    }

    const normalizedPath = path.resolve(dirPath);

    if (!(await exists(normalizedPath))) {
      return NextResponse.json(
        { error: 'Directory does not exist' },
        { status: 404 }
      );
    }

    const stats = await fs.stat(normalizedPath);
    if (!stats.isDirectory()) {
      return NextResponse.json(
        { error: 'Path is not a directory' },
        { status: 400 }
      );
    }

    const entries = await fs.readdir(normalizedPath, { withFileTypes: true });
    const items: DirectoryItem[] = [];

    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      if (entry.name.startsWith('.')) continue;
      if (entry.name === 'node_modules') continue;

      const entryPath = path.join(normalizedPath, entry.name);
      
      const versionJsonPath = path.join(entryPath, 'version.json');
      const versionMeta = await readJson<VersionMeta>(versionJsonPath);
      if (versionMeta) {
        items.push({
          name: entry.name,
          path: entryPath,
          type: 'version',
          versionName: versionMeta.name,
        });
        continue;
      }

      const projectJsonPath = path.join(entryPath, 'project.json');
      const projectMeta = await readJson<ProjectMeta>(projectJsonPath);
      if (projectMeta) {
        items.push({
          name: entry.name,
          path: entryPath,
          type: 'project',
          projectName: projectMeta.name,
        });
        continue;
      }

      items.push({
        name: entry.name,
        path: entryPath,
        type: 'directory',
      });
    }

    items.sort((a, b) => {
      const typeOrder = { version: 0, project: 1, directory: 2 };
      if (typeOrder[a.type] !== typeOrder[b.type]) {
        return typeOrder[a.type] - typeOrder[b.type];
      }
      return a.name.localeCompare(b.name);
    });

    const parentPath = normalizedPath === '/' ? null : path.dirname(normalizedPath);

    const result: BrowseResult = {
      currentPath: normalizedPath,
      parentPath,
      items,
    };

    return NextResponse.json({ data: result });
  } catch (error) {
    console.error('Error browsing directory:', error);
    return NextResponse.json(
      { error: 'Failed to browse directory' },
      { status: 500 }
    );
  }
}
