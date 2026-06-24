import assert from 'node:assert/strict';
import test from 'node:test';
import {
  calculateAiCostMetrics,
  sumBotpressAiCost,
} from './analyticsMetrics.ts';

test('sums Botpress LLM cost records and averages by dashboard conversations', () => {
  const records = [
    { llm: { cost: { sum: 0.12 } } },
    { llm: { cost: { sum: 0.08 } } },
    { llm: { cost: { sum: 0.005 } } },
  ];

  assert.equal(sumBotpressAiCost(records), 0.205);
  assert.deepEqual(calculateAiCostMetrics(records, 5), {
    totalAiCostUsd: 0.205,
    avgAiCostPerConversationUsd: 0.041,
  });
});

test('returns zero average when there are no dashboard conversations', () => {
  const records = [{ llm: { cost: { sum: 2.5 } } }];

  assert.deepEqual(calculateAiCostMetrics(records, 0), {
    totalAiCostUsd: 2.5,
    avgAiCostPerConversationUsd: 0,
  });
});

test('tolerates missing llm or cost values in Botpress analytics records', () => {
  const records = [
    {},
    { llm: {} },
    { llm: { cost: {} } },
    { llm: { cost: { sum: 0.03 } } },
  ];

  assert.equal(sumBotpressAiCost(records), 0.03);
});
