import type { ThinkingOption } from './modelTestingConfig.ts';
import { getProviderFromModelId, resolveModelReference } from './modelTestingModels.ts';

export { getProviderFromModelId } from './modelTestingModels.ts';

export type ModelType = 'cheap' | 'strong';

export type PushLivePayload = {
  modelType: ModelType;
  provider: string;
  model: string;
  temperature: number;
  reasoningEffort: ThinkingOption;
};

export type AiModelConfigRow = PushLivePayload & { id: number };

export function normalizeAiModelConfigRow(row: Record<string, unknown>): AiModelConfigRow | null {
  const id = Number(row.id ?? 0);
  const modelType = row.modelType;
  if (!Number.isFinite(id) || id <= 0 || (modelType !== 'cheap' && modelType !== 'strong')) return null;

  const model = resolveModelReference(typeof row.model === 'string' ? row.model : '');

  return {
    id,
    modelType,
    provider: model ? getProviderFromModelId(model) : typeof row.provider === 'string' ? row.provider : '',
    model,
    temperature: typeof row.temperature === 'number' && Number.isFinite(row.temperature) ? row.temperature : 0,
    reasoningEffort:
      typeof row.reasoningEffort === 'string' &&
      ['none', 'low', 'medium', 'high', 'dynamic'].includes(row.reasoningEffort)
        ? (row.reasoningEffort as ThinkingOption)
        : 'none',
  };
}

export function buildPushLivePayload({
  modelType,
  modelId,
  temperature,
  reasoningEffort,
}: {
  modelType: ModelType;
  modelId: string;
  temperature: number;
  reasoningEffort: ThinkingOption;
}): PushLivePayload {
  const resolvedModel = resolveModelReference(modelId);
  return {
    modelType,
    provider: getProviderFromModelId(resolvedModel),
    model: resolvedModel,
    temperature,
    reasoningEffort,
  };
}

export function buildAiModelTableUpdateRow(current: AiModelConfigRow, payload: PushLivePayload): AiModelConfigRow {
  return { id: current.id, ...payload };
}
