import assert from 'node:assert/strict';
import test from 'node:test';
import type { Client } from '@botpress/client';
import { fetchAnalytics } from './analytics.ts';

test('analytics keeps sequential offset pages, latest conversations, transcript metrics and Botpress costs', async () => {
  const offsets: number[] = [];
  let active = false;
  const client = {
    getBotAnalytics: async (params: { id: string; startDate: string; endDate: string }) => {
      assert.deepEqual(params, { id: 'bot', startDate: 'start', endDate: 'end' });
      return { records: [{ startDateTimeUtc: '2026-06-01T12:00:00Z', llm: { cost: { sum: 0.6 } } }] };
    },
    findTableRows: async (params: { offset: number; filter: unknown }) => {
      assert.equal(active, false);
      active = true;
      offsets.push(params.offset);
      assert.deepEqual(params.filter, { createdAt: { $gte: 'start', $lte: 'end' } });
      await Promise.resolve();
      active = false;
      return params.offset === 0
        ? { rows: [{ id: 1, createdAt: '2026-06-01T10:00:00Z', conversationId: 'a', resolved: false }], hasMore: true }
        : { rows: [
          { id: 2, createdAt: '2026-06-01T12:00:00Z', conversationId: 'a', resolved: true, sentiment: 'positive', transcript: [{ sender: 'user' }, { sender: 'bot' }] },
          { id: 3, createdAt: '2026-06-01T13:00:00Z', conversationId: 'b', resolved: false, sentiment: 'unexpected', transcript: [{ sender: 'user' }] },
        ], hasMore: false };
    },
  } as unknown as Client;
  const result = await fetchAnalytics(client, 'bot', 'start', 'end');
  assert.deepEqual(offsets, [0, 1000]);
  assert.deepEqual(result.summary, {
    totalUsers: 2, totalUserMessages: 2, totalBotMessages: 1, totalConversations: 2,
    avgUserMessagesPerConversation: 1, avgBotMessagesPerConversation: 0.5,
    totalAiCostUsd: 0.6, avgAiCostPerConversationUsd: 0.3,
  });
  assert.deepEqual(result.resolutionData, { resolved: 1, unresolved: 1, resolutionRate: 50 });
  assert.deepEqual(result.sentimentData.map(({ name, value }) => ({ name, value })), [
    { name: 'Positive', value: 1 }, { name: 'Neutral', value: 1 },
  ]);
  assert.equal(result.analyticsData[0].aiCostUsd, 0.6);
});

test('analytics returns empty results for an empty period', async () => {
  const client = {
    getBotAnalytics: async () => ({ records: [] }),
    findTableRows: async () => ({ rows: [], hasMore: false }),
  } as unknown as Client;
  const result = await fetchAnalytics(client, 'bot', 'start', 'end');
  assert.deepEqual(result.analyticsData, []);
  assert.equal(result.summary, null);
  assert.deepEqual(result.sentimentData, []);
  assert.equal(result.resolutionData, null);
});
