import assert from 'node:assert/strict';
import test from 'node:test';
import { createQueryClient } from '../lib/queryClient.ts';
import { queryKeys } from './queryKeys.ts';

test('identical in-flight reads deduplicate and fresh navigation reuses results', async () => {
  const client = createQueryClient();
  let requests = 0;
  const options = {
    queryKey: queryKeys.resource('workspace', 'bot', 'sentiment', { page: 0 }),
    queryFn: async () => { requests += 1; return ['row']; },
  };
  try {
    const results = await Promise.all([client.fetchQuery(options), client.fetchQuery(options)]);
    assert.deepEqual(results, [['row'], ['row']]);
    await client.fetchQuery(options);
    assert.equal(requests, 1);
  } finally { client.clear(); }
});

test('resource invalidation covers pages but isolates other bots, workspaces and resources', async () => {
  const client = createQueryClient();
  const keys = [
    queryKeys.resource('w', 'b', 'prompts', { page: 0 }),
    queryKeys.resource('w', 'b', 'prompts', { page: 1 }),
    queryKeys.resource('w', 'other', 'prompts'),
    queryKeys.resource('other', 'b', 'prompts'),
    queryKeys.resource('w', 'b', 'analytics'),
  ];
  try {
    keys.forEach(key => client.setQueryData(key, ['row']));
    await client.invalidateQueries({ queryKey: queryKeys.resourceRoot('w', 'b', 'prompts') });
    assert.deepEqual(keys.map(key => client.getQueryState(key)?.isInvalidated), [true, true, false, false, false]);
    client.clear();
    assert.equal(client.getQueryCache().getAll().length, 0);
  } finally { client.clear(); }
});

test('clearing a session prevents a pending response from repopulating its cache', async () => {
  const client = createQueryClient();
  // Avoid leaving a GC timer for the deliberately detached pending query.
  client.setDefaultOptions({ queries: { gcTime: 0 } });
  let finish!: (value: string[]) => void;
  const response = new Promise<string[]>(resolve => { finish = resolve; });
  const pending = client.fetchQuery({
    queryKey: queryKeys.resource('w', 'b', 'prompts'),
    queryFn: () => response,
  }).catch(() => undefined);
  client.clear();
  finish(['previous session data']);
  await pending;
  assert.equal(client.getQueryCache().getAll().length, 0);
});
