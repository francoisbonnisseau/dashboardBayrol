import type { CognitiveModel } from '../types/modelTesting.ts';

const HIDDEN_MODEL_TAGS = new Set(['speech-to-text', 'text-to-speech']);

const MODEL_CONFIGS: Record<string, { provider: string; id: string }> = {
  'gpt-5.4': { provider: 'openai', id: 'gpt-5.4-2026-03-05' },
  'gpt-5.4-mini': { provider: 'openai', id: 'gpt-5.4-mini-2026-03-17' },
  'gpt-5.3-chat': { provider: 'openai', id: 'gpt-5.3-chat' },
  'gpt-5': { provider: 'openai', id: 'gpt-5-2025-08-07' },
  'gpt-4.1': { provider: 'openai', id: 'gpt-4.1-2025-04-14' },
  'gpt-4.1-mini': { provider: 'openai', id: 'gpt-4.1-mini-2025-04-14' },
  'gemini-3.1-flash-lite': { provider: 'google-ai', id: 'gemini-3.1-flash-lite' },
  'gemini-3-flash': { provider: 'google-ai', id: 'gemini-3-flash' },
  'gemini-3-pro': { provider: 'google-ai', id: 'gemini-3-pro' },
  'claude-4.6': { provider: 'anthropic', id: 'claude-sonnet-4-6' },
  grok: { provider: 'xai', id: 'grok-4.20-0309-non-reasoning' },
  'grok-reasoning': { provider: 'xai', id: 'grok-4.20-0309-reasoning' },
  kimi: { provider: 'fireworks-ai', id: 'kimi-k2p6' },
};

export function resolveModelReference(modelName: string) {
  const normalizedName = modelName.trim();
  const config = MODEL_CONFIGS[normalizedName];
  return config ? `${config.provider}:${config.id}` : normalizedName;
}

export function getProviderFromModelId(modelId: string) {
  return resolveModelReference(modelId).split(':')[0] || 'other';
}

export function filterDisplayableCognitiveModels(models: CognitiveModel[]) {
  return models.filter(
    (model) => !model.tags?.some((tag) => HIDDEN_MODEL_TAGS.has(tag.trim().toLowerCase()))
  );
}
