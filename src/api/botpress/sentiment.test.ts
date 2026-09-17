import assert from 'node:assert/strict';
import test from 'node:test';
import type { Client } from '@botpress/client';
import {
  getAllConversationMessages,
  getAllSentimentRows,
  getSentimentCount,
} from './sentiment.ts';

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

test('sentiment count uses the active filters without loading the rows', async () => {
  const client = {
    findTableRows: async (query: {
      filter: unknown;
      group: unknown;
      limit: number;
    }) => {
      assert.deepEqual(query.filter, {
        sentiment: { $eq: 'negative' },
        resolved: { $eq: false },
        date: {
          $gte: '2026-06-06T00:00:00.000Z',
          $lte: '2026-06-08T21:59:59.999Z',
        },
      });
      assert.deepEqual(query.group, { conversationId: 'count' });
      assert.equal(query.limit, 1);
      return { rows: [{ conversationIdCount: 42 }], hasMore: false };
    },
  } as unknown as Client;

  const count = await getSentimentCount(client, {
    sentiment: 'negative',
    showResolved: false,
    startDate: new Date('2026-06-06T00:00:00.000Z'),
    endDate: new Date('2026-06-08T10:00:00.000Z'),
  });

  assert.equal(count, 42);
});

test('sentiment export stops at 5,000 rows', async () => {
  const offsets: number[] = [];
  const client = {
    findTableRows: async (query: { offset: number; limit: number }) => {
      offsets.push(query.offset);
      return {
        rows: Array.from({ length: 1000 }, (_, index) => ({
          id: query.offset + index,
          date: '2026-01-01',
          sentiment: 'negative',
        })),
        hasMore: true,
      };
    },
  } as unknown as Client;

  const rows = await getAllSentimentRows(client, {
    sentiment: null,
    showResolved: true,
    startDate: undefined,
    endDate: undefined,
  });

  assert.equal(rows.length, 5000);
  assert.deepEqual(offsets, [0, 1000, 2000, 3000, 4000]);
});

test('conversation messages follow nextToken pagination', async () => {
  const tokens: Array<string | undefined> = [];
  const client = {
    listMessages: async (query: {
      conversationId: string;
      nextToken?: string;
    }) => {
      tokens.push(query.nextToken);
      return query.nextToken
        ? {
            messages: [{ id: 'oldest' }],
            meta: {},
          }
        : {
            messages: [{ id: 'newest' }],
            meta: { nextToken: 'page-2' },
          };
    },
  } as unknown as Client;

  const messages = await getAllConversationMessages(client, 'conversation-1');

  assert.deepEqual(tokens, [undefined, 'page-2']);
  assert.deepEqual(messages.map((message) => message.id), ['newest', 'oldest']);
});
