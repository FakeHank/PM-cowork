import { z } from 'zod';

// ============================================
// Zod Schemas for AI Workflow Pipeline
// ============================================

export const TechDesignSchema = z.object({
  pages: z.array(
    z.object({
      id: z.string(),
      name: z.string(),
      description: z.string(),
      layout: z.string(),
    })
  ),
  components: z.array(
    z.object({
      name: z.string(),
      purpose: z.string(),
      props: z.array(z.string()),
      placement: z.string(),
    })
  ),
  designTokens: z.object({
    primaryColor: z.string(),
    fontFamily: z.string(),
    spacing: z.string(),
  }),
  dataFlow: z.string(),
  navigationType: z.enum(['tabs', 'sidebar', 'none']),
});

export const ImplementationPlanSchema = z.object({
  tasks: z.array(
    z.object({
      pageId: z.string(),
      pageName: z.string(),
      description: z.string(),
      acceptanceCriteria: z.array(z.string()),
      priority: z.number(),
    })
  ),
  sharedComponents: z.array(z.string()),
  implementationOrder: z.array(z.string()),
});

export const QualityReportSchema = z.object({
  overallScore: z.number(),
  pageReviews: z.array(
    z.object({
      pageId: z.string(),
      score: z.number(),
      issues: z.array(z.string()),
      suggestions: z.array(z.string()),
    })
  ),
  passesThreshold: z.boolean(),
});

// ============================================
// TypeScript Types (inferred from schemas)
// ============================================

export type TechDesign = z.infer<typeof TechDesignSchema>;
export type ImplementationPlan = z.infer<typeof ImplementationPlanSchema>;
export type QualityReport = z.infer<typeof QualityReportSchema>;

// ============================================
// Workflow Event Types
// ============================================

export type WorkflowStepName = 'architect' | 'planner' | 'coder' | 'reviewer';
export type WorkflowStepStatus = 'running' | 'complete' | 'error';

export type WorkflowEvent =
  | {
      event: 'step';
      step: WorkflowStepName;
      status: WorkflowStepStatus;
      detail?: string;
      result?: unknown;
    }
  | {
      event: 'error';
      step: WorkflowStepName;
      error: string;
    }
  | {
      event: 'done';
      canvasId: string;
      pageCount: number;
    };
