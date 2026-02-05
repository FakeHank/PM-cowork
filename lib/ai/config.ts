import { anthropic, createAnthropic } from '@ai-sdk/anthropic';
import { openai, createOpenAI } from '@ai-sdk/openai';
import { readJson, SETTINGS_FILE } from '@/lib/fs';
import type { AppSettings, ProviderType } from '@/lib/types';

const DEFAULT_SETTINGS: AppSettings = {
  provider: {
    provider: 'anthropic',
    defaultModel: 'claude-sonnet-4-20250514',
  },
  theme: 'system',
};

function createModelInstance(
  provider: ProviderType,
  modelId: string,
  apiKey?: string,
  baseUrl?: string
) {
  switch (provider) {
    case 'anthropic': {
      if (apiKey) {
        const customAnthropic = createAnthropic({ apiKey });
        return customAnthropic(modelId);
      }
      return anthropic(modelId);
    }
    
    case 'openai': {
      if (apiKey) {
        const customOpenAI = createOpenAI({ apiKey });
        return customOpenAI(modelId);
      }
      return openai(modelId);
    }
    
    case 'custom': {
      if (!baseUrl) {
        throw new Error('Custom provider requires baseUrl');
      }
      const customProvider = createOpenAI({
        baseURL: baseUrl,
        apiKey: apiKey || '',
        name: 'custom',
      });
      // Use .chat() to force /chat/completions endpoint
      // Default provider() uses /responses which most OpenAI-compatible services don't support
      return customProvider.chat(modelId);
    }
    
    default:
      return anthropic('claude-sonnet-4-20250514');
  }
}

export async function getModel() {
  const settings = await readJson<AppSettings>(SETTINGS_FILE);
  const { provider, defaultModel, apiKey, baseUrl } = settings?.provider || DEFAULT_SETTINGS.provider;
  
  return createModelInstance(provider, defaultModel, apiKey, baseUrl);
}

export async function getModelWithId(modelId: string) {
  const settings = await readJson<AppSettings>(SETTINGS_FILE);
  const { provider, apiKey, baseUrl } = settings?.provider || DEFAULT_SETTINGS.provider;
  
  return createModelInstance(provider, modelId, apiKey, baseUrl);
}
