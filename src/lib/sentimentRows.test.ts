import assert from 'node:assert/strict';
import test from 'node:test';
import { buildSentimentRowsQuery } from './sentimentRows.ts';

test('builds a lightweight first-page query with server-side filters', () => {
  const query = buildSentimentRowsQuery({
    page: 0,
    sentiment: 'negative',
    showResolved: false,
    startDate: new Date('2026-06-06T00:00:00.000Z'),
    endDate: new Date('2026-06-08T10:00:00.000Z'),
  });

  assert.equal(query.limit, 1000);
  assert.equal(query.offset, 0);
  assert.deepEqual(query.select, [
    'date',
    'topics',
    'resolved',
    'sentiment',
    'conversationId',
  ]);
  assert.deepEqual(query.filter, {
    sentiment: { $eq: 'negative' },
    resolved: { $eq: false },
    date: {
      $gte: '2026-06-06T00:00:00.000Z',
      $lte: '2026-06-08T21:59:59.999Z',
    },
  });
  assert.equal(query.orderBy, 'date');
  assert.equal(query.orderDirection, 'desc');
});

test('uses the page to calculate offset and omits inactive filters', () => {
  const query = buildSentimentRowsQuery({
    page: 3,
    sentiment: null,
    showResolved: true,
    startDate: undefined,
    endDate: undefined,
  });

  assert.equal(query.offset, 3000);
  assert.deepEqual(query.filter, {});
});
