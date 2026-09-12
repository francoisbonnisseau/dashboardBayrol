import assert from 'node:assert/strict';
import test from 'node:test';
import {
  buildPromotionUpdates,
  buildTestingDraftValues,
  partitionPromptRows,
  type PromptRow,
} from './promptVersions.ts';

const live: PromptRow = {
  id: 1,
  label: 'Live',
  prompt: 'Published content',
  version: 'live',
  deployDate: '2026-09-01T12:00:00Z',
};
const testing: PromptRow = {
  id: 2,
  label: 'Testing',
  prompt: 'Saved draft',
  version: 'testing',
  deployDate: null,
};

test('publishing archives the old live version and promotes only the saved testing row', () => {
  assert.deepEqual(
    buildPromotionUpdates({ live, testing, now: '2026-09-12T12:00:00Z' }),
    [
      { id: 1, version: 'legacy', deployDate: live.deployDate },
      { id: 2, version: 'live', deployDate: '2026-09-12T12:00:00Z' },
    ],
  );
  assert.equal(live.version, 'live');
  assert.equal(testing.prompt, 'Saved draft');
});

test('a new draft copies source content without its live or deployment status', () => {
  assert.deepEqual(buildTestingDraftValues(live), {
    label: 'Live',
    prompt: 'Published content',
    version: 'testing',
    deployDate: null,
  });
  assert.equal(buildTestingDraftValues().version, 'testing');
});

test('history remains read-only version data in newest-first order', () => {
  const older = { ...live, id: 3, version: 'legacy' as const };
  const newer = { ...older, id: 4, deployDate: '2026-09-10T12:00:00Z' };
  const result = partitionPromptRows([older, testing, newer, live]);
  assert.equal(result.live, live);
  assert.equal(result.testing, testing);
  assert.deepEqual(
    result.legacy.map((row) => row.id),
    [4, 3],
  );
});
