import type { ThinkingOption } from './modelTestingConfig.ts';

export type PushLivePayload = {
  provider: string;
  model: string;
  temperature: number;
  reasoningEffort: ThinkingOption;
};

export type AiModelConfigRow = PushLivePayload & {
  id: number;
};

export function getProviderFromModelId(modelId: string) {
  return modelId.split(':')[0] || 'other';
}

export function normalizeAiModelConfigRow(row: Record<string, unknown>): AiModelConfigRow | null {
  const id = Number(row.id ?? 0);
  if (!Number.isFinite(id) || id <= 0) {
    return null;
  }

  return {
    id,
    provider: typeof row.provider === 'string' ? row.provider : '',
    model: typeof row.model === 'string' ? row.model : '',
    temperature: typeof row.temperature === 'number' && Number.isFinite(row.temperature) ? row.temperature : 0,
    reasoningEffort:
      typeof row.reasoningEffort === 'string' &&
      ['none', 'low', 'medium', 'high', 'dynamic'].includes(row.reasoningEffort)
        ? (row.reasoningEffort as ThinkingOption)
        : 'none',
  };
}

export function buildPushLivePayload({
  modelId,
  temperature,
  reasoningEffort,
}: {
  modelId: string;
  temperature: number;
  reasoningEffort: ThinkingOption;
}): PushLivePayload {
  return {
    provider: getProviderFromModelId(modelId),
    model: modelId,
    temperature,
    reasoningEffort,
  };
}

export function buildAiModelTableUpdateRow(current: AiModelConfigRow, payload: PushLivePayload): AiModelConfigRow {
  return {
    id: current.id,
    ...payload,
  };
}
