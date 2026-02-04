import { NextRequest, NextResponse } from 'next/server';
import path from 'path';
import { exists, ensureDir, writeJson, writeText, generateId, slugify } from '@/lib/fs';
import type { ProjectMeta, VersionMeta } from '@/lib/fs/types';

const DEFAULT_SPEC_TEMPLATE = `# v1

## 概述

简要描述这个版本要解决的问题和目标。

## 用户故事

### 作为 [用户角色]

我希望 [功能描述]
以便 [价值/收益]

## 功能需求

### 核心功能

- [ ] 功能点 1
- [ ] 功能点 2

### 次要功能

- [ ] 功能点 3

## 非功能需求

- 性能要求
- 安全要求
- 兼容性要求

## 约束与假设

### 约束

- 约束 1

### 假设

- 假设 1

## 开放问题

- 问题 1
`;

export async function POST(request: NextRequest) {
  try {
    const { folderPath, projectName } = await request.json();

    if (!folderPath || typeof folderPath !== 'string') {
      return NextResponse.json(
        { error: 'folderPath is required' },
        { status: 400 }
      );
    }

    const normalizedPath = path.resolve(folderPath);

    if (!(await exists(normalizedPath))) {
      await ensureDir(normalizedPath);
    }

    const projectJsonPath = path.join(normalizedPath, 'project.json');
    if (await exists(projectJsonPath)) {
      return NextResponse.json(
        { error: 'Project already exists in this folder' },
        { status: 409 }
      );
    }

    const now = new Date().toISOString();
    const derivedProjectName = projectName || path.basename(normalizedPath);

    const projectMeta: ProjectMeta = {
      id: slugify(derivedProjectName) || generateId(),
      name: derivedProjectName,
      createdAt: now,
      updatedAt: now,
    };

    await ensureDir(path.join(normalizedPath, 'inbox'));
    await ensureDir(path.join(normalizedPath, 'versions'));
    await writeJson(projectJsonPath, projectMeta);

    const versionFolderName = 'v1';
    const versionPath = path.join(normalizedPath, 'versions', versionFolderName);
    
    const versionMeta: VersionMeta = {
      id: versionFolderName,
      name: 'v1',
      status: 'active',
      createdAt: now,
      updatedAt: now,
    };

    await ensureDir(versionPath);
    await ensureDir(path.join(versionPath, 'sessions'));
    await ensureDir(path.join(versionPath, 'assets'));
    await ensureDir(path.join(versionPath, 'references'));
    await writeJson(path.join(versionPath, 'version.json'), versionMeta);
    await writeText(path.join(versionPath, 'spec.md'), DEFAULT_SPEC_TEMPLATE);

    return NextResponse.json({
      data: {
        projectPath: normalizedPath,
        projectName: projectMeta.name,
        versionPath,
        versionName: versionMeta.name,
      },
    });
  } catch (error) {
    console.error('Error initializing folder:', error);
    return NextResponse.json(
      { error: 'Failed to initialize project' },
      { status: 500 }
    );
  }
}
