export interface CognitiveModel {
  id: string;
  name: string;
  description?: string;
  tags?: string[];
  lifecycle?: string;
  aliases?: string[];
  input?: {
    maxTokens?: number;
    costPer1MTokens?: number;
  };
  output?: {
    maxTokens?: number;
    costPer1MTokens?: number;
  };
  capabilities?: {
    supportsImages?: boolean;
    supportsAudio?: boolean;
    supportsTranscription?: boolean;
    supportsSearch?: boolean;
  };
}

export type ModelTestMode = 'single' | 'compare';

export type LocalChatMessage = {
  role: 'user' | 'assistant';
  content: string;
};

export interface ModelResponse {
  modelId: string;
  text: string;
  error?: string;
  pending?: boolean;
  latencyMs: number;
  usage?: {
    inputTokens?: number;
    outputTokens?: number;
    inputCost?: number;
    outputCost?: number;
  } | null;
}

export interface ChatTurn {
  id: string;
  userText: string;
  createdAt: string;
  modelA: ModelResponse;
  modelB?: ModelResponse;
}

export interface PerModelHistory {
  modelA: LocalChatMessage[];
  modelB: LocalChatMessage[];
}
