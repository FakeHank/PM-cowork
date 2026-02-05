import { generateText } from 'ai';
import type { LanguageModel } from 'ai';
import type { ZodType } from 'zod';
import { z } from 'zod';

/**
 * Extract JSON from model response text.
 * Handles: raw JSON, markdown code blocks, text with embedded JSON.
 */
function extractJson(text: string): string {
  const codeBlockMatch = text.match(/```(?:json)?\s*\n?([\s\S]*?)```/);
  if (codeBlockMatch) {
    return codeBlockMatch[1].trim();
  }

  const firstBrace = text.indexOf('{');
  const lastBrace = text.lastIndexOf('}');
  if (firstBrace !== -1 && lastBrace > firstBrace) {
    return text.slice(firstBrace, lastBrace + 1);
  }

  return text.trim();
}

/**
 * Generate a structured object from a model that may not support tool calling
 * or response_format. Falls back to generateText + JSON extraction + Zod validation.
 */
export async function generateStructured<T>(options: {
  model: LanguageModel;
  schema: ZodType<T>;
  system: string;
  messages: Array<{ role: 'user' | 'assistant'; content: string }>;
  abortSignal?: AbortSignal;
}): Promise<T> {
  const { model, schema, system, messages, abortSignal } = options;

  const jsonSchemaDesc = JSON.stringify(z.toJSONSchema(schema), null, 2);

  const augmentedSystem = `${system}

IMPORTANT: You MUST respond with ONLY a valid JSON object matching this schema. No markdown, no explanation, no code blocks — just the raw JSON object.

JSON Schema:
${jsonSchemaDesc}`;

  const result = await generateText({
    model,
    system: augmentedSystem,
    messages,
    abortSignal,
  });

  const jsonStr = extractJson(result.text);

  let parsed: unknown;
  try {
    parsed = JSON.parse(jsonStr);
  } catch {
    throw new Error(
      `Failed to parse model response as JSON. Response starts with: "${result.text.slice(0, 200)}"`
    );
  }

  const validated = schema.safeParse(parsed);
  if (!validated.success) {
    throw new Error(
      `Model response does not match schema: ${validated.error.message}`
    );
  }

  return validated.data;
}
