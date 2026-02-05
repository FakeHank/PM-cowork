import path from 'path';
import { promises as fs } from 'fs';
import { PROJECTS_ROOT, exists, readText, ensureDir, writeText } from './index';

export interface FileEntry {
  name: string;
  path: string;
  type: 'file' | 'directory';
  size?: number;
  mtime?: string;
  isSpecFile?: boolean;
}

function versionPath(projectId: string, versionFolder: string): string {
  return path.join(PROJECTS_ROOT, projectId, 'versions', versionFolder);
}

export async function listVersionFiles(versionId: string): Promise<FileEntry[]> {
  const [projectId, versionFolder] = versionId.split('/');
  if (!projectId || !versionFolder) return [];

  const basePath = versionPath(projectId, versionFolder);
  if (!(await exists(basePath))) return [];

  const entries: FileEntry[] = [];

  async function scanDir(dirPath: string, relativePath: string = '') {
    try {
      const items = await fs.readdir(dirPath, { withFileTypes: true });
      
      for (const item of items) {
        if (item.name === 'version.json') continue;
        
        const itemPath = path.join(dirPath, item.name);
        const relPath = relativePath ? `${relativePath}/${item.name}` : item.name;
        
        if (item.isDirectory()) {
          entries.push({
            name: item.name,
            path: relPath,
            type: 'directory',
          });
          await scanDir(itemPath, relPath);
        } else {
          const stats = await fs.stat(itemPath);
          entries.push({
            name: item.name,
            path: relPath,
            type: 'file',
            size: stats.size,
            mtime: stats.mtime.toISOString(),
            isSpecFile: item.name === 'spec.md',
          });
        }
      }
    } catch (err) {
      console.error('Error scanning directory:', err);
    }
  }

  await scanDir(basePath);
  
  const getParentPath = (entry: FileEntry) => {
    const idx = entry.path.lastIndexOf('/');
    return idx === -1 ? '' : entry.path.slice(0, idx);
  };

  const parseSessionTimestamp = (name: string): number | null => {
    const base = name.replace(/\.json$/, '');
    if (!/^\d+$/.test(base)) return null;
    const value = Number(base);
    return Number.isFinite(value) ? value : null;
  };

  entries.sort((a, b) => {
    const parentA = getParentPath(a);
    const parentB = getParentPath(b);
    if (parentA !== parentB) {
      return parentA.localeCompare(parentB);
    }

    if (a.isSpecFile) return -1;
    if (b.isSpecFile) return 1;
    if (a.type === 'directory' && b.type === 'file') return -1;
    if (a.type === 'file' && b.type === 'directory') return 1;

    if (parentA === 'sessions') {
      const aTime = parseSessionTimestamp(a.name);
      const bTime = parseSessionTimestamp(b.name);
      if (aTime !== null && bTime !== null) return bTime - aTime;
      if (aTime !== null || bTime !== null) return aTime !== null ? -1 : 1;
      return b.name.localeCompare(a.name);
    }

    return a.name.localeCompare(b.name);
  });

  return entries;
}

export async function readVersionFile(versionId: string, filePath: string): Promise<string | null> {
  const [projectId, versionFolder] = versionId.split('/');
  if (!projectId || !versionFolder) return null;

  const fullPath = path.join(versionPath(projectId, versionFolder), filePath);
  
  const basePath = versionPath(projectId, versionFolder);
  const normalizedPath = path.normalize(fullPath);
  if (!normalizedPath.startsWith(basePath)) {
    return null;
  }

  return readText(fullPath);
}

export async function writeVersionFile(versionId: string, filePath: string, content: string): Promise<boolean> {
  const [projectId, versionFolder] = versionId.split('/');
  if (!projectId || !versionFolder) return false;

  const fullPath = path.join(versionPath(projectId, versionFolder), filePath);
  
  const basePath = versionPath(projectId, versionFolder);
  const normalizedPath = path.normalize(fullPath);
  if (!normalizedPath.startsWith(basePath)) {
    return false;
  }

  try {
    await writeText(fullPath, content);
    return true;
  } catch {
    return false;
  }
}

export async function ensureVersionDirs(versionId: string): Promise<void> {
  const [projectId, versionFolder] = versionId.split('/');
  if (!projectId || !versionFolder) return;

  const basePath = versionPath(projectId, versionFolder);
  await ensureDir(path.join(basePath, 'assets'));
  await ensureDir(path.join(basePath, 'references'));
}
