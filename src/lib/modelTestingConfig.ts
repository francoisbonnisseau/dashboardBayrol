import type { ChatTurn, LocalChatMessage, PerModelHistory } from '../types/modelTesting.ts';

export const THINKING_OPTIONS = ['none', 'low', 'medium', 'high', 'dynamic'] as const;
export const STATIC_THINKING_OPTIONS = ['low', 'medium', 'high'] as const;

export type ThinkingOption = (typeof THINKING_OPTIONS)[number];
export type StaticThinkingOption = (typeof STATIC_THINKING_OPTIONS)[number];
export type ModeKey = 'single' | 'compare';

export type ModeSnapshot = {
  thinking: ThinkingOption;
  staticThinking: StaticThinkingOption;
  temperature: number;
  selectedProviderA: string;
  selectedProviderB: string;
  selectedModelA: string;
  selectedModelB: string;
  selectedPromptKey: string;
  turns: ChatTurn[];
  singleHistory: LocalChatMessage[];
  compareHistory: PerModelHistory;
};

export type SavedBotState = {
  currentMode: ModeKey;
  modes: Partial<Record<ModeKey, ModeSnapshot>>;
};

type ConversationState = Pick<ModeSnapshot, 'turns' | 'singleHistory' | 'compareHistory'>;

const EMPTY_CONVERSATION_STATE: ConversationState = {
  turns: [],
  singleHistory: [],
  compareHistory: { modelA: [], modelB: [] },
};

export function buildSavedStateWithConversation({
  existingState,
  currentMode,
  mode,
  currentSnapshot,
  chatState,
}: {
  existingState: SavedBotState | null;
  currentMode: ModeKey;
  mode: ModeKey;
  currentSnapshot: ModeSnapshot;
  chatState: ConversationState;
}): SavedBotState {
  const baseSnapshot =
    mode === currentMode ? currentSnapshot : existingState?.modes?.[mode] ?? currentSnapshot;

  return {
    currentMode: mode === currentMode ? mode : existingState?.currentMode ?? currentMode,
    modes: {
      ...(existingState?.modes ?? {}),
      [mode]: {
        ...baseSnapshot,
        turns: chatState.turns,
        singleHistory: chatState.singleHistory,
        compareHistory: chatState.compareHistory,
      },
    },
  };
}

export function buildSavedStateWithClearedConversation({
  existingState,
  currentMode,
  currentSnapshot,
}: {
  existingState: SavedBotState | null;
  currentMode: ModeKey;
  currentSnapshot: ModeSnapshot;
}): SavedBotState {
  return buildSavedStateWithConversation({
    existingState,
    currentMode,
    mode: currentMode,
    currentSnapshot,
    chatState: EMPTY_CONVERSATION_STATE,
  });
}
