import { generateText } from 'ai';
import type { LanguageModel } from 'ai';
import type { TechDesign, ImplementationPlan } from './types';
import { CANVAS_GENERATE_SYSTEM_PROMPT } from '../prompts';

function extractHtmlContent(text: string): string {
  const docTypeMatch = text.match(/<!DOCTYPE html>[\s\S]*/i);
  if (docTypeMatch) {
    return docTypeMatch[0].trim();
  }

  const htmlMatch = text.match(/<html[\s\S]*<\/html>/i);
  if (htmlMatch) {
    return `<!DOCTYPE html>\n${htmlMatch[0]}`;
  }

  return text.trim();
}

export async function runCoder(
  task: ImplementationPlan['tasks'][number],
  techDesign: TechDesign,
  model: LanguageModel,
  signal?: AbortSignal
): Promise<{ pageId: string; pageName: string; htmlContent: string }> {
  // Build shared components list
  const sharedComponentsList = techDesign.components
    .map((c) => `- ${c.name}: ${c.purpose}`)
    .join('\n');

  // Build user message with task, tech design, and shared components
  const userMessage = `## Task
Page ID: ${task.pageId}
Page Name: ${task.pageName}

Description:
${task.description}

Acceptance Criteria:
${task.acceptanceCriteria.map((c) => `- ${c}`).join('\n')}

## Technical Design
\`\`\`json
${JSON.stringify(techDesign, null, 2)}
\`\`\`

## Shared Components
${sharedComponentsList}

Generate a complete, standalone HTML page for this task using Tailwind CSS. The page should meet all acceptance criteria and follow the design guidelines provided.`;

  const result = await generateText({
    model,
    system: CANVAS_GENERATE_SYSTEM_PROMPT,
    messages: [{ role: 'user', content: userMessage }],
    abortSignal: signal,
  });

  const htmlContent = extractHtmlContent(result.text);

  return {
    pageId: task.pageId,
    pageName: task.pageName,
    htmlContent,
  };
}
