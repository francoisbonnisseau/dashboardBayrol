import assert from 'node:assert/strict';
import test from 'node:test';
import {
  buildSavedStateWithClearedConversation,
  buildSavedStateWithConversation,
  type ModeSnapshot,
  type SavedBotState,
} from './modelTestingConfig.ts';

function turn(id: string) {
  return {
    id,
    createdAt: '2026-05-11T12:00:00.000Z',
    userText: 'Bonjour',
    modelA: {
      modelId: 'openai:gpt-4o-mini',
      text: 'Bonjour',
      latencyMs: 100,
      usage: null,
    },
  };
}

function snapshot(overrides: Partial<ModeSnapshot> = {}): ModeSnapshot {
  return {
    thinking: 'medium',
    staticThinking: 'medium',
    temperature: 0.3,
    selectedProviderA: 'openai',
    selectedProviderB: 'anthropic',
    selectedModelA: 'openai:gpt-4o-mini',
    selectedModelB: 'anthropic:claude-3-haiku',
    selectedPromptKey: 'testing',
    turns: [turn('existing-turn')],
    singleHistory: [
      { role: 'user', content: 'Ancien message' },
      { role: 'assistant', content: 'Ancienne reponse' },
    ],
    compareHistory: {
      modelA: [{ role: 'user', content: 'Ancien A' }],
      modelB: [{ role: 'user', content: 'Ancien B' }],
    },
    ...overrides,
  };
}

test('persisting a test turn keeps the latest selected model instead of a stale saved model', () => {
  const existingState: SavedBotState = {
    currentMode: 'single',
    modes: {
      single: snapshot({
        selectedProviderA: 'anthropic',
        selectedModelA: 'anthropic:claude-3-haiku',
      }),
    },
  };
  const currentSnapshot = snapshot({
    selectedProviderA: 'anthropic',
    selectedModelA: 'anthropic:claude-3-5-sonnet',
  });
  const nextTurn = turn('new-turn');
  const nextState = buildSavedStateWithConversation({
    existingState,
    currentMode: 'single',
    mode: 'single',
    currentSnapshot,
    chatState: {
      turns: [nextTurn],
      singleHistory: [{ role: 'user', content: 'Nouveau message' }],
      compareHistory: { modelA: [], modelB: [] },
    },
  });

  assert.equal(nextState.modes.single?.selectedProviderA, 'anthropic');
  assert.equal(nextState.modes.single?.selectedModelA, 'anthropic:claude-3-5-sonnet');
  assert.deepEqual(nextState.modes.single?.turns, [nextTurn]);
  assert.deepEqual(nextState.modes.single?.singleHistory, [{ role: 'user', content: 'Nouveau message' }]);
});

test('clearing a conversation after a model change preserves the new model selection', () => {
  const existingState: SavedBotState = {
    currentMode: 'compare',
    modes: {
      compare: snapshot({
        selectedProviderA: 'openai',
        selectedModelA: 'openai:gpt-4o-mini',
        selectedProviderB: 'anthropic',
        selectedModelB: 'anthropic:claude-3-haiku',
      }),
    },
  };
  const currentSnapshot = snapshot({
    selectedProviderA: 'google-ai',
    selectedModelA: 'google-ai:gemini-2.5-flash',
    selectedProviderB: 'anthropic',
    selectedModelB: 'anthropic:claude-3-5-sonnet',
  });
  const nextState = buildSavedStateWithClearedConversation({
    existingState,
    currentMode: 'compare',
    currentSnapshot,
  });

  assert.equal(nextState.currentMode, 'compare');
  assert.equal(nextState.modes.compare?.selectedModelA, 'google-ai:gemini-2.5-flash');
  assert.equal(nextState.modes.compare?.selectedModelB, 'anthropic:claude-3-5-sonnet');
  assert.deepEqual(nextState.modes.compare?.turns, []);
  assert.deepEqual(nextState.modes.compare?.singleHistory, []);
  assert.deepEqual(nextState.modes.compare?.compareHistory, { modelA: [], modelB: [] });
});
