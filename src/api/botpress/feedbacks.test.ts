import assert from 'node:assert/strict';
import test from 'node:test';
import type { Client } from '@botpress/client';
import { buildFeedbackRowsQuery, getAllFeedbackRows } from './feedbacks.ts';
test('feedback lists use server filters and bounded pagination with detail fields', () => {
  const endDate = new Date('2026-06-08T10:00:00Z');
  const end = new Date(endDate);
  end.setHours(23, 59, 59, 999);
  const query = buildFeedbackRowsQuery({
    page: 2, reaction: 'negative', startDate: new Date('2026-06-01T00:00:00Z'), endDate
  });
  assert.equal(query.limit, 100);
  assert.equal(query.offset, 200);
  assert.deepEqual(query.filter, {
    reaction: { $eq: 'negative' }, messageDate: {
      $gte: '2026-06-01T00:00:00.000Z', $lte: end.toISOString()
    }
  });
  assert.ok(query.select.includes('messageId'));
  assert.ok(query.select.includes('comment'));
  assert.equal(endDate.toISOString(), '2026-06-08T10:00:00.000Z');
});
test('feedback export traverses all pages independently of list pagination', async () => {
  const calls: Array<{
    offset?: number;
    limit?: number;
  }> = [];
  const client = { findTableRows: async (query: {
      offset: number;
      limit: number;
    }) => {
      calls.push(query);
      return {
        rows: [{
            id: calls.length, createdAt: '2026-01-01'
          }], hasMore: calls.length < 3
      };
    } } as unknown as Client;
  const rows = await getAllFeedbackRows(client, {
    reaction: null, startDate: undefined, endDate: undefined
  });
  assert.deepEqual(rows.map(row => row.id), [1, 2, 3]);
  assert.deepEqual(calls.map(({ offset, limit }) => ({
    offset, limit
  })), [{
      offset: 0, limit: 1000
    }, {
      offset: 1000, limit: 1000
    }, {
      offset: 2000, limit: 1000
    }]);
});
