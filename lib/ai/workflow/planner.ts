import type { LanguageModel } from 'ai';
import { TechDesign, ImplementationPlan, ImplementationPlanSchema } from './types';
import { generateStructured } from './generate-structured';

const PLANNER_SYSTEM_PROMPT = `You are an expert implementation planner. Convert the technical design into a detailed implementation plan.

Your task:
1. Create one task per page from the TechDesign
2. Define shared components that appear across multiple pages
3. Determine implementation order (consider dependencies)

For each task:
- pageId must match the ID from TechDesign.pages
- Include specific acceptance criteria (3-5 items)
- Priority: 1 (highest) to N`;

export async function runPlanner(
  techDesign: TechDesign,
  model: LanguageModel,
  signal?: AbortSignal
): Promise<ImplementationPlan> {
  return generateStructured({
    model,
    schema: ImplementationPlanSchema,
    system: PLANNER_SYSTEM_PROMPT,
    messages: [{ role: 'user', content: JSON.stringify(techDesign) }],
    abortSignal: signal,
  });
}
