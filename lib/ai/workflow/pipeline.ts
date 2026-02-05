import path from 'path';
import type { WorkflowEvent } from './types';
import { runArchitect } from './architect';
import { runPlanner } from './planner';
import { runCoder } from './coder';
import { runReviewer } from './reviewer';
import { getModel } from '../config';
import {
  PROJECTS_ROOT,
  readText,
  writeText,
  readJson,
  writeJson,
  generateId,
  ensureDir,
  removeFile,
} from '@/lib/fs';
import { canvasExists, createCanvas, getCanvas } from '@/lib/fs/canvas';
import type { CanvasMeta, CanvasPageMeta } from '@/lib/fs/canvas-types';
import { commit } from '@/lib/git';

export async function runWorkflowPipeline(
  versionId: string,
  signal?: AbortSignal,
  onEvent?: (event: WorkflowEvent) => void
): Promise<void> {
  const emit = (event: WorkflowEvent) => onEvent?.(event);

  // --- Setup ---
  const model = await getModel();

  const [projectId, versionFolder] = versionId.split('/');
  if (!projectId || !versionFolder) {
    throw new Error('Invalid versionId format. Expected "projectId/versionFolder"');
  }

  const projectPath = path.join(PROJECTS_ROOT, projectId, 'versions', versionFolder);
  const specPath = path.join(projectPath, 'spec.md');
  const canvasDir = path.join(projectPath, 'canvas');
  const metaPath = path.join(canvasDir, 'canvas.json');
  const pagesDir = path.join(canvasDir, 'pages');

  const specContent = await readText(specPath);
  if (!specContent || specContent.trim().length === 0) {
    throw new Error('Cannot run workflow: spec.md is empty or missing');
  }

  // --- Ensure canvas exists ---
  if (!(await canvasExists(versionId))) {
    await createCanvas(versionId, 'Canvas');
  }
  const canvas = await getCanvas(versionId);
  if (!canvas) {
    throw new Error('Failed to create or load canvas');
  }

  // --- Step 1: Architect ---
  emit({ event: 'step', step: 'architect', status: 'running' });
  const techDesign = await runArchitect(specContent, model, signal);
  emit({
    event: 'step',
    step: 'architect',
    status: 'complete',
    result: { pageCount: techDesign.pages.length },
  });
  if (signal?.aborted) return;

  // --- Step 2: Planner ---
  emit({ event: 'step', step: 'planner', status: 'running' });
  const plan = await runPlanner(techDesign, model, signal);
  emit({
    event: 'step',
    step: 'planner',
    status: 'complete',
    result: { taskCount: plan.tasks.length },
  });
  if (signal?.aborted) return;

  // --- Pre-allocate pages in canvas.json (prevents race condition) ---
  const meta = await readJson<CanvasMeta>(metaPath);
  if (!meta) {
    throw new Error('Canvas metadata not found');
  }

  for (const oldPage of meta.pages) {
    await removeFile(path.join(pagesDir, `${oldPage.id}.html`));
  }
  meta.pages = [];

  const now = new Date().toISOString();
  const taskToCanvasPageId = new Map<string, string>();

  for (const task of plan.tasks) {
    const canvasPageId = generateId();
    taskToCanvasPageId.set(task.pageId, canvasPageId);

    const pageMeta: CanvasPageMeta = {
      id: canvasPageId,
      name: task.pageName,
      description: task.description,
      htmlPath: `pages/${canvasPageId}.html`,
      createdAt: now,
      updatedAt: now,
    };
    meta.pages.push(pageMeta);
  }

  meta.updatedAt = now;
  await writeJson(metaPath, meta);
  await ensureDir(pagesDir);

  // --- Step 3: Coder (parallel) ---
  emit({ event: 'step', step: 'coder', status: 'running' });

  const coderResults = await Promise.allSettled(
    plan.tasks.map((task) => runCoder(task, techDesign, model, signal))
  );

  const successfulPages: Array<{ pageId: string; pageName: string; htmlContent: string }> = [];
  let completedCount = 0;

  for (let i = 0; i < coderResults.length; i++) {
    const result = coderResults[i];
    completedCount++;

    if (result.status === 'fulfilled') {
      const page = result.value;
      const canvasPageId = taskToCanvasPageId.get(page.pageId);
      if (canvasPageId) {
        await writeText(path.join(pagesDir, `${canvasPageId}.html`), page.htmlContent);
      }
      successfulPages.push(page);
      emit({
        event: 'step',
        step: 'coder',
        status: 'running',
        detail: `Generated page: ${page.pageName} (${completedCount}/${plan.tasks.length})`,
      });
    } else {
      emit({
        event: 'step',
        step: 'coder',
        status: 'running',
        detail: `Failed page: ${plan.tasks[i].pageName} (${completedCount}/${plan.tasks.length})`,
      });
    }
  }

  emit({
    event: 'step',
    step: 'coder',
    status: 'complete',
    result: { generated: successfulPages.length, total: plan.tasks.length },
  });
  if (signal?.aborted) return;

  // --- Step 4: Reviewer ---
  emit({ event: 'step', step: 'reviewer', status: 'running' });

  if (successfulPages.length === 0) {
    emit({
      event: 'step',
      step: 'reviewer',
      status: 'complete',
      result: { overallScore: 0, passesThreshold: false },
    });
  } else {
    let report = await runReviewer(successfulPages, techDesign, model, signal);

    if (!report.passesThreshold) {
      const failingPageIds = new Set(
        report.pageReviews.filter((r) => r.score < 7).map((r) => r.pageId)
      );
      const failingTasks = plan.tasks.filter((t) => failingPageIds.has(t.pageId));

      if (failingTasks.length > 0) {
        emit({
          event: 'step',
          step: 'reviewer',
          status: 'running',
          detail: `Retrying ${failingTasks.length} failing page(s)`,
        });

        const retryResults = await Promise.allSettled(
          failingTasks.map((task) => runCoder(task, techDesign, model, signal))
        );

        for (const retryResult of retryResults) {
          if (retryResult.status === 'fulfilled') {
            const page = retryResult.value;
            const canvasPageId = taskToCanvasPageId.get(page.pageId);
            if (canvasPageId) {
              await writeText(path.join(pagesDir, `${canvasPageId}.html`), page.htmlContent);
            }
            const idx = successfulPages.findIndex((p) => p.pageId === page.pageId);
            if (idx !== -1) {
              successfulPages[idx] = page;
            }
          }
        }

        report = await runReviewer(successfulPages, techDesign, model, signal);
      }
    }

    emit({
      event: 'step',
      step: 'reviewer',
      status: 'complete',
      result: { overallScore: report.overallScore, passesThreshold: report.passesThreshold },
    });
  }

  // --- Final metadata update ---
  const finalMeta = await readJson<CanvasMeta>(metaPath);
  if (finalMeta) {
    const finalNow = new Date().toISOString();
    for (const page of finalMeta.pages) {
      page.updatedAt = finalNow;
    }
    finalMeta.updatedAt = finalNow;
    await writeJson(metaPath, finalMeta);
  }

  // --- Git commit (exactly once) ---
  await commit(projectPath, 'Canvas workflow: generate multi-page prototype');

  // --- Done ---
  emit({
    event: 'done',
    canvasId: canvas.id,
    pageCount: successfulPages.length,
  });
}
