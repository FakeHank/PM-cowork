import type { LanguageModel } from 'ai';
import { TechDesign, QualityReport, QualityReportSchema } from './types';
import { generateStructured } from './generate-structured';

const REVIEWER_SYSTEM_PROMPT = `You are a senior frontend code reviewer evaluating HTML+Tailwind prototypes.

Your task:
Evaluate each generated page against the technical design and score on:
1. Fidelity to design (does it match the intended layout and components?)
2. Code quality (clean HTML, proper Tailwind classes)
3. Accessibility (semantic tags, ARIA where needed)
4. Responsiveness (mobile-friendly)

Scoring:
- Score each page 1-10
- overallScore is the average of all page scores
- passesThreshold: true if overallScore >= 7

For each page, list:
- Specific issues found
- Actionable suggestions for improvement`;

export async function runReviewer(
  pages: Array<{ pageId: string; pageName: string; htmlContent: string }>,
  techDesign: TechDesign,
  model: LanguageModel,
  signal?: AbortSignal
): Promise<QualityReport> {
  const formattedPages = pages
    .map(
      (page) => `
Page ID: ${page.pageId}
Page Name: ${page.pageName}
HTML Content:
\`\`\`html
${page.htmlContent}
\`\`\`
`
    )
    .join('\n');

  const userMessage = `
Technical Design:
${JSON.stringify(techDesign, null, 2)}

Generated Pages:
${formattedPages}

Please review each page against the technical design and provide a quality report.
`;

  return generateStructured({
    model,
    schema: QualityReportSchema,
    system: REVIEWER_SYSTEM_PROMPT,
    messages: [{ role: 'user', content: userMessage }],
    abortSignal: signal,
  });
}
