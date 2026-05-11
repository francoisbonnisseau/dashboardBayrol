import type { CognitiveModel } from '../types/modelTesting.ts';

const HIDDEN_MODEL_TAGS = new Set(['speech-to-text', 'text-to-speech']);

export function filterDisplayableCognitiveModels(models: CognitiveModel[]) {
  return models.filter(
    (model) => !model.tags?.some((tag) => HIDDEN_MODEL_TAGS.has(tag.trim().toLowerCase()))
  );
}
