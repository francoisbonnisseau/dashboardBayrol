import type { Message } from '../types';

type PayloadRecord = Record<string, unknown>;

export interface StepListItem {
  title?: string;
  text?: string;
}

export interface SourceItem {
  docName?: string;
  title?: string;
  description?: string;
  picture?: string;
  url?: string;
}

export interface StructuredMessagePayload {
  kind: 'step_list' | 'sources';
  title?: string;
  steps?: StepListItem[];
  items?: SourceItem[];
}

function asRecord(value: unknown): PayloadRecord | null {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? value as PayloadRecord
    : null;
}

function asString(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value : undefined;
}

function normalizeKind(value: string | undefined): string | undefined {
  return value?.trim().toLowerCase().replace(/-/g, '_');
}

function getKindCandidates(payload: PayloadRecord): string[] {
  const data = asRecord(payload.data);
  return [
    asString(payload.type),
    asString(payload.name),
    asString(data?.type),
  ].filter((value): value is string => Boolean(value));
}

export function getMessageKind(payload: Message['payload']): string | undefined {
  const record = asRecord(payload);
  if (!record) return undefined;

  const candidates = getKindCandidates(record);
  return candidates.find((candidate) => normalizeKind(candidate) !== 'custom') ?? candidates[0];
}

export function getMessageText(payload: Message['payload']): string | undefined {
  const record = asRecord(payload);
  if (!record) return undefined;

  const directText = asString(record.text);
  if (directText) return directText;

  const items = Array.isArray(record.items) ? record.items : [];
  const itemTexts = items.flatMap((item) => {
    const itemRecord = asRecord(item);
    const itemPayload = asRecord(itemRecord?.payload);
    const itemText = asString(itemPayload?.text) ?? asString(itemRecord?.text);
    return itemText ? [itemText] : [];
  });

  return itemTexts.length > 0 ? itemTexts.join('\n\n') : undefined;
}

export function getStructuredMessagePayload(
  payload: Message['payload'],
): StructuredMessagePayload | undefined {
  const record = asRecord(payload);
  if (!record) return undefined;

  const data = asRecord(record.data) ?? record;
  const kind = normalizeKind(getMessageKind(payload));

  if (
    (kind === 'step_list' || kind === 'steps_list' || kind === 'steps_lists') &&
    Array.isArray(data.steps)
  ) {
    const steps = data.steps.flatMap((step) => {
      const stepRecord = asRecord(step);
      if (!stepRecord) return [];

      return [{
        title: asString(stepRecord.title),
        text: asString(stepRecord.text),
      }];
    });

    return {
      kind: 'step_list',
      title: asString(data.title),
      steps,
    };
  }

  if (kind === 'sources' && Array.isArray(data.items)) {
    const items = data.items.flatMap((item) => {
      const itemRecord = asRecord(item);
      if (!itemRecord) return [];

      return [{
        docName: asString(itemRecord.docName),
        title: asString(itemRecord.title),
        description: asString(itemRecord.description),
        picture: asString(itemRecord.picture),
        url: asString(itemRecord.url),
      }];
    });

    return {
      kind: 'sources',
      title: asString(data.title),
      items,
    };
  }

  return undefined;
}

export function getMessageTypeLabel(payload: Message['payload']): string {
  const kind = normalizeKind(getMessageKind(payload));

  switch (kind) {
    case 'bloc':
      return 'User message block';
    case 'step_list':
    case 'steps_list':
    case 'steps_lists':
      return 'Step-by-step guide';
    case 'sources':
      return 'Sources';
    case 'text':
      return 'Text message';
    default:
      return kind ? `Message type: ${kind.replace(/_/g, ' ')}` : 'Unrecognized message payload';
  }
}

export function shouldShowPayloadDetails(payload: Message['payload']): boolean {
  const record = asRecord(payload);
  if (!record) return false;

  const kind = normalizeKind(getMessageKind(payload));
  return Boolean((kind && kind !== 'text') || (!getMessageText(payload) && Object.keys(record).length > 0));
}

export function isSafeHttpUrl(value: string | undefined): value is string {
  if (!value) return false;

  try {
    const url = new URL(value);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
}
