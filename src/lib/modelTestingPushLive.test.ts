import assert from 'node:assert/strict';
import test from 'node:test';
import { buildAiModelTableUpdateRow, buildPushLivePayload, normalizeAiModelConfigRow } from './modelTestingPushLive.ts';

test('builds push to live payload with provider, model, temperature, and reasoning effort', () => {
  assert.deepEqual(
    buildPushLivePayload({
      modelId: 'openai:gpt-4.1-mini',
      temperature: 0.3,
      reasoningEffort: 'dynamic',
    }),
    {
      provider: 'openai',
      model: 'openai:gpt-4.1-mini',
      temperature: 0.3,
      reasoningEffort: 'dynamic',
    }
  );
});

test('normalizes the current AIModelTable row and builds an update for the same row id', () => {
  const current = normalizeAiModelConfigRow({
    id: 1,
    provider: 'anthropic',
    model: 'anthropic:claude-3-5-sonnet',
    temperature: 0.7,
    reasoningEffort: 'high',
  });

  assert.deepEqual(current, {
    id: 1,
    provider: 'anthropic',
    model: 'anthropic:claude-3-5-sonnet',
    temperature: 0.7,
    reasoningEffort: 'high',
  });
  assert.deepEqual(
    buildAiModelTableUpdateRow(current, {
      provider: 'openai',
      model: 'openai:gpt-4.1-mini',
      temperature: 0.3,
      reasoningEffort: 'medium',
    }),
    {
      id: 1,
      provider: 'openai',
      model: 'openai:gpt-4.1-mini',
      temperature: 0.3,
      reasoningEffort: 'medium',
    }
  );
});
