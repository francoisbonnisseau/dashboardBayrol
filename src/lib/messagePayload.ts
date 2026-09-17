import type { Message } from '../types';
import type { StructuredMessagePayload } from '../types/structuredMessage.ts';

export type {
  SourceItem,
  StepListItem,
  StructuredMessagePayload,
} from '../types/structuredMessage.ts';

type PayloadRecord = Record<string, unknown>;

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

export interface ExportedConversationMessage {
  id: string;
  date: string;
  role: 'user' | 'bot';
  type: string | null;
  content: string | StructuredMessagePayload | Record<string, unknown> | null;
}

function getChoiceContent(
  payload: Message['payload'],
): Record<string, unknown> | undefined {
  const record = asRecord(payload);
  if (!record || !Array.isArray(record.options)) return undefined;

  const options = record.options.flatMap((option) => {
    const optionRecord = asRecord(option);
    if (!optionRecord) return [];

    return [{
      label: asString(optionRecord.label),
      value: asString(optionRecord.value),
    }];
  });

  return {
    ...(getMessageText(payload) ? { text: getMessageText(payload) } : {}),
    options,
  };
}

function getExportedMessageContent(
  payload: Message['payload'],
): ExportedConversationMessage['content'] {
  const structured = getStructuredMessagePayload(payload);
  if (structured) return structured;

  const choiceContent = getChoiceContent(payload);
  if (choiceContent) return choiceContent;

  const text = getMessageText(payload);
  if (text) return text;

  const record = asRecord(payload);
  if (!record) return null;

  const content = { ...record };
  delete content.type;
  return Object.keys(content).length > 0 ? content : null;
}

export function serializeMessageForExport(
  message: Pick<Message, 'id' | 'createdAt' | 'direction' | 'payload'> & {
    type?: string;
  },
): ExportedConversationMessage {
  return {
    id: message.id,
    date: message.createdAt,
    role: message.direction === 'incoming' ? 'user' : 'bot',
    type: getMessageKind(message.payload) ?? message.type ?? null,
    content: getExportedMessageContent(message.payload),
  };
}

export function serializeMessagesForExport(
  messages: Array<Pick<Message, 'id' | 'createdAt' | 'direction' | 'payload'> & { type?: string }>,
) {
  const seenMessageIds = new Set<string>();

  return messages
    .slice()
    .reverse()
    .filter((message) => {
      if (seenMessageIds.has(message.id)) return false;
      seenMessageIds.add(message.id);
      return true;
    })
    .map(serializeMessageForExport);
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
