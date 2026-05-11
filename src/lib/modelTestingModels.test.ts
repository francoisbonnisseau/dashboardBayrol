import assert from 'node:assert/strict';
import test from 'node:test';
import { filterDisplayableCognitiveModels } from './modelTestingModels.ts';
import type { CognitiveModel } from '../types/modelTesting.ts';

function model(id: string, tags: string[] = []): CognitiveModel {
  return {
    id,
    name: id,
    tags,
  };
}

test('filters speech-to-text and text-to-speech models from display lists', () => {
  const models = [
    model('openai:gpt-4.1', ['recommended']),
    model('openai:whisper-1', ['speech-to-text']),
    model('openai:tts-1', ['text-to-speech']),
    model('anthropic:claude-3-5-sonnet'),
  ];

  assert.deepEqual(
    filterDisplayableCognitiveModels(models).map((entry) => entry.id),
    ['openai:gpt-4.1', 'anthropic:claude-3-5-sonnet']
  );
});
