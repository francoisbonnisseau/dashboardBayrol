import assert from 'node:assert/strict';
import test from 'node:test';
import { buildAiModelTableUpdateRow, buildPushLivePayload, normalizeAiModelConfigRow } from './modelTestingPushLive.ts';

test('builds one payload per modelType', () => {
  assert.deepEqual(buildPushLivePayload({ modelType: 'cheap', modelId: 'openai:gpt-4.1-mini', temperature: 0.1, reasoningEffort: 'low' }), {
    modelType: 'cheap', provider: 'openai', model: 'openai:gpt-4.1-mini', temperature: 0.1, reasoningEffort: 'low',
  });
});

test('normalizes and updates a strong row without changing its id', () => {
  const current = normalizeAiModelConfigRow({ id: 2, modelType: 'strong', provider: 'anthropic', model: 'anthropic:claude', temperature: 0.7, reasoningEffort: 'high' });
  assert.ok(current);
  assert.deepEqual(buildAiModelTableUpdateRow(current, buildPushLivePayload({ modelType: 'strong', modelId: 'openai:gpt-5.4', temperature: 0.3, reasoningEffort: 'medium' })), {
    id: 2, modelType: 'strong', provider: 'openai', model: 'openai:gpt-5.4', temperature: 0.3, reasoningEffort: 'medium',
  });
});

test('rejects rows without a recognized modelType', () => {
  assert.equal(normalizeAiModelConfigRow({ id: 1, model: 'openai:gpt-4.1' }), null);
});
