import { NextRequest, NextResponse } from 'next/server';
import path from 'path';
import { exists, readJson, listDirs } from '@/lib/fs';
import type { ProjectMeta, VersionMeta } from '@/lib/fs/types';

export interface FolderDetectResult {
  type: 'version' | 'project' | 'unknown';
  folderPath: string;
  projectPath?: string;
  projectName?: string;
  versionPath?: string;
  versionName?: string;
  latestVersion?: {
    path: string;
    name: string;
  };
}

export async function POST(request: NextRequest) {
  try {
    const { folderPath } = await request.json();

    if (!folderPath || typeof folderPath !== 'string') {
      return NextResponse.json(
        { error: 'folderPath is required' },
        { status: 400 }
      );
    }

    const normalizedPath = path.resolve(folderPath);

    if (!(await exists(normalizedPath))) {
      return NextResponse.json(
        { error: 'Folder does not exist' },
        { status: 404 }
      );
    }

    const versionJsonPath = path.join(normalizedPath, 'version.json');
    if (await exists(versionJsonPath)) {
      const versionMeta = await readJson<VersionMeta>(versionJsonPath);
      
      const parentPath = path.dirname(path.dirname(normalizedPath));
      const projectJsonPath = path.join(parentPath, 'project.json');
      let projectName: string | undefined;
      let projectPath: string | undefined;
      
      if (await exists(projectJsonPath)) {
        const projectMeta = await readJson<ProjectMeta>(projectJsonPath);
        projectName = projectMeta?.name;
        projectPath = parentPath;
      }

      const result: FolderDetectResult = {
        type: 'version',
        folderPath: normalizedPath,
        projectPath,
        projectName,
        versionPath: normalizedPath,
        versionName: versionMeta?.name || path.basename(normalizedPath),
      };

      return NextResponse.json({ data: result });
    }

    const projectJsonPath = path.join(normalizedPath, 'project.json');
    if (await exists(projectJsonPath)) {
      const projectMeta = await readJson<ProjectMeta>(projectJsonPath);
      
      const versionsDir = path.join(normalizedPath, 'versions');
      let latestVersion: { path: string; name: string } | undefined;
      
      if (await exists(versionsDir)) {
        const versionFolders = await listDirs(versionsDir);
        
        let latestTime = 0;
        for (const folder of versionFolders) {
          const versionPath = path.join(versionsDir, folder);
          const versionMetaPath = path.join(versionPath, 'version.json');
          const versionMeta = await readJson<VersionMeta>(versionMetaPath);
          
          if (versionMeta) {
            const updatedTime = new Date(versionMeta.updatedAt).getTime();
            if (updatedTime > latestTime) {
              latestTime = updatedTime;
              latestVersion = {
                path: versionPath,
                name: versionMeta.name,
              };
            }
          }
        }
      }

      const result: FolderDetectResult = {
        type: 'project',
        folderPath: normalizedPath,
        projectPath: normalizedPath,
        projectName: projectMeta?.name || path.basename(normalizedPath),
        latestVersion,
      };

      return NextResponse.json({ data: result });
    }

    const result: FolderDetectResult = {
      type: 'unknown',
      folderPath: normalizedPath,
    };

    return NextResponse.json({ data: result });
  } catch (error) {
    console.error('Error detecting folder:', error);
    return NextResponse.json(
      { error: 'Failed to detect folder type' },
      { status: 500 }
    );
  }
}
