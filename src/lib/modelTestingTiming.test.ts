import assert from 'node:assert/strict';
import test from 'node:test';
import { buildTimingBreakdownTitle, getDisplayedLatencyMs } from './modelTestingTiming.ts';
import type { ModelResponse } from '../types/modelTesting.ts';

test('uses wall-clock total for displayed latency when timing details are available', () => {
  const response: ModelResponse = {
    modelId: 'openai:gpt-4o-mini',
    text: 'Bonjour',
    latencyMs: 900,
    usage: null,
    timing: {
      totalMs: 1234,
      segments: [
        { label: 'Premier run IA', durationMs: 400 },
        { label: 'Run tool searchKnowledge', durationMs: 300 },
        { label: 'Deuxieme run IA', durationMs: 500 },
      ],
    },
  };

  assert.equal(getDisplayedLatencyMs(response), 1234);
  assert.equal(
    buildTimingBreakdownTitle(response),
    'Total: 1,2 s\nPremier run IA: 0,4 s\nRun tool searchKnowledge: 0,3 s\nDeuxieme run IA: 0,5 s'
  );
});

test('falls back to existing latency when no timing details are available', () => {
  const response: ModelResponse = {
    modelId: 'openai:gpt-4o-mini',
    text: 'Bonjour',
    latencyMs: 900,
    usage: null,
  };

  assert.equal(getDisplayedLatencyMs(response), 900);
  assert.equal(buildTimingBreakdownTitle(response), null);
});
