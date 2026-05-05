import { createOpenAI } from '@ai-sdk/openai';
import { createAnthropic } from '@ai-sdk/anthropic';
import { createOpenRouter } from '@openrouter/ai-sdk-provider';
import { LanguageModelV1 } from 'ai';
import {
  getModelById,
  getProviderById,
  type AIModel,
  type AIConfig
} from '@/lib/ai-models';
import { getDecryptedApiKey } from '@/utils/actions/api-keys/actions';

// Re-export types for backward compatibility
export type { ApiKey, AIConfig } from '@/lib/ai-models';

// Hidden/internal-only models that should not appear in the public selector
type HiddenModel = Pick<AIModel, 'id' | 'provider' | 'features' | 'availability'>;
const HIDDEN_MODELS: Record<string, HiddenModel> = {
  'openai/gpt-5-nano': {
    id: 'openai/gpt-5-nano',
    provider: 'openrouter',
    features: {
      isFree: true,
      isUnstable: false,
      maxTokens: 400000,
      supportsVision: false,
      supportsTools: true,
    },
    availability: {
      requiresApiKey: true,
      requiresPro: false,
    },
  },
};

export async function initializeAIClient(config: AIConfig): Promise<LanguageModelV1> {
  const modelData = getModelById(config.model) ?? HIDDEN_MODELS[config.model];
  const resolvedModelId = modelData?.id ?? config.model;
  const provider = modelData ? getProviderById(modelData.provider) : undefined;

  if (!modelData || !provider) {
    throw new Error(`Unknown model: ${config.model}`);
  }

  // All models with a slash in their ID go through OpenRouter
  if (resolvedModelId.includes('/')) {
    const apiKey = await getDecryptedApiKey('openrouter');
    if (!apiKey) {
      throw new Error('Add your OpenRouter API key in Profile settings to use this model');
    }
    return createOpenRouter({
      apiKey,
      baseURL: 'https://openrouter.ai/api/v1',
      headers: {
        'HTTP-Referer': process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000',
        'X-Title': 'ResumeLM',
      },
    })(resolvedModelId) as LanguageModelV1;
  }

  const apiKey = await getDecryptedApiKey(provider.id);
  if (!apiKey) {
    throw new Error(`Add your ${provider.name} API key in Profile settings to use this model`);
  }

  switch (provider.id) {
    case 'anthropic':
      return createAnthropic({ apiKey })(resolvedModelId) as LanguageModelV1;
    case 'openai':
      return createOpenAI({ apiKey, compatibility: 'strict' })(resolvedModelId) as LanguageModelV1;
    case 'openrouter':
      return createOpenRouter({
        apiKey,
        baseURL: 'https://openrouter.ai/api/v1',
        headers: {
          'HTTP-Referer': process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000',
          'X-Title': 'ResumeLM',
        },
      })(resolvedModelId) as LanguageModelV1;
    default:
      throw new Error(`Unsupported provider: ${provider.id}`);
  }
}
