import type { LanguageModel } from 'ai';
import { TechDesign, TechDesignSchema } from './types';
import { generateStructured } from './generate-structured';

const ARCHITECT_SYSTEM_PROMPT = `You are an expert UI/UX architect. Analyze the product spec and create a comprehensive technical design for an HTML+Tailwind prototype.

Your task:
1. Decompose the spec into logical pages (max 8 pages)
2. Define reusable components
3. Specify design tokens (colors, typography, spacing)
4. Describe data flow between pages
5. Choose navigation type

Constraints:
- Each page must be a standalone HTML file with Tailwind CSS
- Use Tailwind CDN (no build step)
- Max 8 pages total
- Semantic HTML, accessible, responsive`;

export async function runArchitect(
  specContent: string,
  model: LanguageModel,
  signal?: AbortSignal
): Promise<TechDesign> {
  if (!specContent || specContent.trim().length === 0) {
    throw new Error('Cannot run workflow: spec.md is empty or missing');
  }

  return generateStructured({
    model,
    schema: TechDesignSchema,
    system: ARCHITECT_SYSTEM_PROMPT,
    messages: [{ role: 'user', content: specContent }],
    abortSignal: signal,
  });
}
