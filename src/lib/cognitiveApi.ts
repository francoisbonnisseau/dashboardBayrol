import type { CognitiveModel, LocalChatMessage } from '../types/modelTesting.ts';

const COGNITIVE_MODELS_URL = 'https://api.botpress.cloud/v2/cognitive/models';
const COGNITIVE_GENERATE_TEXT_URL = 'https://api.botpress.cloud/v2/cognitive/generate-text';

interface GenerateTextParams {
  token: string;
  botId: string;
  model: string;
  systemPrompt: string;
  messages: LocalChatMessage[];
  temperature: number;
  maxTokens: number;
  reasoningEffort?: 'none' | 'low' | 'medium' | 'high' | 'dynamic';
  responseFormat?: 'json_object' | 'text';
  timeoutMs?: number;
}

interface GenerateTextResult {
  text: string;
  usage: {
    inputTokens?: number;
    outputTokens?: number;
    inputCost?: number;
    outputCost?: number;
  } | null;
  raw: unknown;
  latencyMs: number;
}

function extractTextFromCognitiveResponse(rawResponse: any): string {
  const firstChoice = rawResponse?.choices?.[0];

  if (typeof firstChoice?.content === 'string') {
    return firstChoice.content;
  }

  if (Array.isArray(firstChoice?.content)) {
    return firstChoice.content.map((part: any) => part?.text || '').join(' ').trim();
  }

  if (typeof firstChoice?.message?.content === 'string') {
    return firstChoice.message.content;
  }

  if (Array.isArray(firstChoice?.message?.content)) {
    return firstChoice.message.content.map((part: any) => part?.text || '').join(' ').trim();
  }

  if (typeof rawResponse?.output === 'string') {
    return rawResponse.output;
  }

  if (typeof rawResponse?.outputText === 'string') {
    return rawResponse.outputText;
  }

  if (typeof rawResponse?.text === 'string') {
    return rawResponse.text;
  }

  return '';
}

function extractUsage(rawResponse: any) {
  return rawResponse?.usage || rawResponse?.metadata?.usage || null;
}

function buildHeaders(token: string, botId: string): HeadersInit {
  return {
    Authorization: `Bearer ${token}`,
    'X-Bot-Id': botId,
    'Content-Type': 'application/json',
  };
}

export async function fetchCognitiveModels(token: string, botId: string): Promise<CognitiveModel[]> {
  const response = await fetch(COGNITIVE_MODELS_URL, {
    method: 'GET',
    headers: buildHeaders(token, botId),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Unable to load models (${response.status}): ${errorText || 'Unknown error'}`);
  }

  const data = await response.json();
  if (!Array.isArray(data?.models)) {
    return [];
  }

  return data.models as CognitiveModel[];
}

export async function generateTextWithCognitiveApi({
  token,
  botId,
  model,
  systemPrompt,
  messages,
  temperature,
  maxTokens,
  reasoningEffort,
  responseFormat,
  timeoutMs = 45000,
}: GenerateTextParams): Promise<GenerateTextResult> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  const startedAt = performance.now();

  const payload = {
    model,
    temperature,
    maxTokens,
    reasoningEffort,
    responseFormat,
    messages: [
      {
        role: 'system',
        type: 'text',
        content: systemPrompt,
      },
      ...messages.map((message) => ({
        role: message.role,
        type: 'text',
        content: message.content,
      })),
    ],
  };

  try {
    const response = await fetch(COGNITIVE_GENERATE_TEXT_URL, {
      method: 'POST',
      headers: buildHeaders(token, botId),
      body: JSON.stringify(payload),
      signal: controller.signal,
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Generation failed (${response.status}): ${errorText || 'Unknown error'}`);
    }

    const raw = await response.json();
    return {
      text: extractTextFromCognitiveResponse(raw),
      usage: extractUsage(raw),
      raw,
      latencyMs: Math.round(performance.now() - startedAt),
    };
  } catch (error: any) {
    if (error?.name === 'AbortError') {
      throw new Error(`Generation timeout after ${timeoutMs}ms`);
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}
