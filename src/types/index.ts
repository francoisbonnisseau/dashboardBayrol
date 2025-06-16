export interface BotConfig {
  id: string;
  name: string;
  botId: string;
}

export interface AppSettings {
  token: string;
  workspaceId: string;
  bots: BotConfig[];
}

export interface Conversation {
  id: string;
  currentTaskId?: string;
  currentWorkflowId?: string;
  createdAt: string;
  updatedAt: string;
  channel: string;
  integration: string;
  tags: Record<string, string | number | boolean>;
}

export interface ConversationsResponse {
  conversations: Conversation[];
  meta: {
    nextToken?: string;
  };
}

export interface Message {
  id: string;
  conversationId: string;
  direction: 'incoming' | 'outgoing';
  payload: {
    text?: string;
    type?: string;
    [key: string]: any;
  };
  createdAt: string;
  userId?: string;
}
