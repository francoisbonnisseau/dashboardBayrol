import assert from 'node:assert/strict';
import test from 'node:test';
import type { Client } from '@botpress/client';
import { getAllSentimentRows } from './sentiment.ts';

test('sentiment export includes filtered rows beyond the UI page', async () => {
  const offsets: number[] = [];
  const client = {
    findTableRows: async (query: { offset: number; limit: number; filter: unknown }) => {
      offsets.push(query.offset);
      assert.equal(query.limit, 1000);
      assert.deepEqual(query.filter, { sentiment: { $eq: 'negative' }, resolved: { $eq: false } });
      return { rows: [{ id: offsets.length, date: '2026-01-01', sentiment: 'negative' }], hasMore: offsets.length < 2 };
    },
  } as unknown as Client;
  const rows = await getAllSentimentRows(client, {
    sentiment: 'negative', showResolved: false, startDate: undefined, endDate: undefined,
  });
  assert.deepEqual(offsets, [0, 1000]);
  assert.deepEqual(rows.map(row => row.id), [1, 2]);
});
