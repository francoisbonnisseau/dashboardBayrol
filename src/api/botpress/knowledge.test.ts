import assert from 'node:assert/strict';
import test from 'node:test';
import type { Client } from '@botpress/client';
import { fetchKnowledgeRows, fetchIntroRows } from './knowledge.ts';

test('loads complete knowledge datasets using bounded sequential pages', async () => {
  const calls: Array<{ offset?: number; limit?: number; table: string }> = [];
  const client = {
    findTableRows: async (input: { offset: number; limit: number; table: string }) => {
      calls.push(input);
      return { rows: Array.from({ length: input.offset < 100 ? 100 : 3 }, (_, i) => ({ id: input.offset + i })) };
    },
  } as unknown as Client;
  const rows = await fetchKnowledgeRows(client, 'learningsTable');
  assert.equal(rows.length, 103);
  assert.equal(rows[102].id, 102);
  assert.deepEqual(calls.map(({ offset, limit }) => ({ offset, limit })), [
    { offset: 0, limit: 100 }, { offset: 100, limit: 100 },
  ]);
});

test('stops requesting further pages when the query is cancelled', async () => {
  const controller = new AbortController();
  let calls = 0;
  const client = {
    findTableRows: async () => {
      calls++;
      controller.abort();
      return { rows: Array.from({ length: 100 }, (_, id) => ({ id })) };
    },
  } as unknown as Client;
  await assert.rejects(fetchKnowledgeRows(client, 'introTable', controller.signal), { name: 'AbortError' });
  assert.equal(calls, 1);
});

test('preserves intro live normalization used for publication', async () => {
  const client = {
    findTableRows: async () => ({ rows: [
      { id: 1, live: true, sentence: 'Question', season: 'winter' },
      { id: 2, live: 'YES' },
      { id: 3, live: false },
      { id: 4 },
    ] }),
  } as unknown as Client;
  const rows = await fetchIntroRows(client);
  assert.deepEqual(rows.map(row => row.live), ['yes', 'yes', 'no', '']);
  assert.equal(rows[0].sentence, 'Question');
  assert.equal(rows[1].sentence, '');
});
