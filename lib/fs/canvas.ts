import path from 'path';
import { PROJECTS_ROOT, ensureDir, exists, readJson, writeJson, readText, writeText, generateId, listDirs } from './index';
import { initRepo, isGitRepo, commit } from '../git/index';
import type { CanvasMeta, CanvasPageMeta, CanvasPageData, CanvasData } from './canvas-types';

// ============================================
// Path Utilities
// ============================================

function versionPath(projectId: string, versionFolder: string): string {
  return path.join(PROJECTS_ROOT, projectId, 'versions', versionFolder);
}

function canvasPath(versionId: string): string {
  const [projectId, versionFolder] = versionId.split('/');
  if (!projectId || !versionFolder) {
    throw new Error('Invalid versionId format');
  }
  return path.join(versionPath(projectId, versionFolder), 'canvas');
}

function canvasMetaPath(versionId: string): string {
  return path.join(canvasPath(versionId), 'canvas.json');
}

function canvasPagesDir(versionId: string): string {
  return path.join(canvasPath(versionId), 'pages');
}

function pageHtmlPath(versionId: string, pageId: string): string {
  return path.join(canvasPagesDir(versionId), `${pageId}.html`);
}

// ============================================
// Canvas CRUD Operations
// ============================================

/**
 * Check if canvas exists for a version
 * @param versionId - Version ID in format "projectId/versionFolder"
 * @returns true if canvas exists, false otherwise
 */
export async function canvasExists(versionId: string): Promise<boolean> {
  try {
    const metaPath = canvasMetaPath(versionId);
    return await exists(metaPath);
  } catch {
    return false;
  }
}

/**
 * Create a new canvas with git initialization
 * @param versionId - Version ID in format "projectId/versionFolder"
 * @param name - Canvas name
 * @returns Created canvas data
 */
export async function createCanvas(versionId: string, name: string): Promise<CanvasData> {
  const [projectId, versionFolder] = versionId.split('/');
  if (!projectId || !versionFolder) {
    throw new Error('Invalid versionId format');
  }

  // Check if canvas already exists
  if (await canvasExists(versionId)) {
    throw new Error('Canvas already exists for this version');
  }

  const now = new Date().toISOString();
  const canvasId = generateId();

  // Create canvas directory structure
  const canvasDir = canvasPath(versionId);
  const pagesDir = canvasPagesDir(versionId);
  await ensureDir(canvasDir);
  await ensureDir(pagesDir);

  // Initialize git repository if not already initialized
  const projectPath = versionPath(projectId, versionFolder);
  if (!(await isGitRepo(projectPath))) {
    await initRepo(projectPath);
  }

  // Create canvas metadata
  const meta: CanvasMeta = {
    id: canvasId,
    versionId,
    name,
    pages: [],
    createdAt: now,
    updatedAt: now,
  };

  // Save metadata
  await writeJson(canvasMetaPath(versionId), meta);

  // Commit canvas creation
  await commit(projectPath, `Create canvas: ${name}`);

  return {
    ...meta,
    pages: [],
  };
}

/**
 * Get canvas with all page data
 * @param versionId - Version ID in format "projectId/versionFolder"
 * @returns Canvas data with all pages, or null if not found
 */
export async function getCanvas(versionId: string): Promise<CanvasData | null> {
  try {
    // Read canvas metadata
    const meta = await readJson<CanvasMeta>(canvasMetaPath(versionId));
    if (!meta) {
      return null;
    }

    // Load HTML content for each page
    const pages: CanvasPageData[] = [];
    for (const pageMeta of meta.pages) {
      const htmlContent = await readText(pageHtmlPath(versionId, pageMeta.id));
      pages.push({
        ...pageMeta,
        htmlContent: htmlContent || '',
      });
    }

    return {
      ...meta,
      pages,
    };
  } catch {
    return null;
  }
}

/**
 * Save canvas page HTML content with git commit
 * @param versionId - Version ID in format "projectId/versionFolder"
 * @param pageId - Page ID
 * @param htmlContent - HTML content to save
 * @param commitMessage - Git commit message
 */
export async function saveCanvasPage(
  versionId: string,
  pageId: string,
  htmlContent: string,
  commitMessage: string
): Promise<void> {
  const [projectId, versionFolder] = versionId.split('/');
  if (!projectId || !versionFolder) {
    throw new Error('Invalid versionId format');
  }

  // Verify canvas exists
  const meta = await readJson<CanvasMeta>(canvasMetaPath(versionId));
  if (!meta) {
    throw new Error('Canvas not found');
  }

  // Verify page exists
  const pageIndex = meta.pages.findIndex((p) => p.id === pageId);
  if (pageIndex === -1) {
    throw new Error('Page not found');
  }

  // Save HTML content
  await writeText(pageHtmlPath(versionId, pageId), htmlContent);

  // Update page metadata
  meta.pages[pageIndex].updatedAt = new Date().toISOString();
  meta.updatedAt = new Date().toISOString();
  await writeJson(canvasMetaPath(versionId), meta);

  // Commit changes
  const projectPath = versionPath(projectId, versionFolder);
  await commit(projectPath, commitMessage);
}

/**
 * Add a new page to canvas
 * @param versionId - Version ID in format "projectId/versionFolder"
 * @param name - Page name
 * @param htmlContent - Optional initial HTML content
 * @returns Created page data
 */
export async function addCanvasPage(
  versionId: string,
  name: string,
  htmlContent?: string
): Promise<CanvasPageData> {
  const [projectId, versionFolder] = versionId.split('/');
  if (!projectId || !versionFolder) {
    throw new Error('Invalid versionId format');
  }

  // Verify canvas exists
  const meta = await readJson<CanvasMeta>(canvasMetaPath(versionId));
  if (!meta) {
    throw new Error('Canvas not found');
  }

  const now = new Date().toISOString();
  const pageId = generateId();

  // Create page metadata
  const pageMeta: CanvasPageMeta = {
    id: pageId,
    name,
    htmlPath: `pages/${pageId}.html`,
    createdAt: now,
    updatedAt: now,
  };

  // Add page to canvas
  meta.pages.push(pageMeta);
  meta.updatedAt = now;
  await writeJson(canvasMetaPath(versionId), meta);

  // Save initial HTML content
  const content = htmlContent || '';
  await writeText(pageHtmlPath(versionId, pageId), content);

  // Commit changes
  const projectPath = versionPath(projectId, versionFolder);
  await commit(projectPath, `Add canvas page: ${name}`);

  return {
    ...pageMeta,
    htmlContent: content,
  };
}

/**
 * Get canvas by its ID (scans all projects/versions)
 * @param canvasId - Canvas ID
 * @returns Canvas data with all pages, or null if not found
 */
export async function getCanvasById(canvasId: string): Promise<CanvasData | null> {
  try {
    const projects = await listDirs(PROJECTS_ROOT);
    
    for (const projectId of projects) {
      const versionsDir = path.join(PROJECTS_ROOT, projectId, 'versions');
      const versions = await listDirs(versionsDir);
      
      for (const versionFolder of versions) {
        const versionId = `${projectId}/${versionFolder}`;
        const meta = await readJson<CanvasMeta>(canvasMetaPath(versionId));
        
        if (meta && meta.id === canvasId) {
          return await getCanvas(versionId);
        }
      }
    }
    
    return null;
  } catch {
    return null;
  }
}
