import assert from 'node:assert/strict';
import test from 'node:test';
import { buildPromptDiff } from './promptDiff.ts';

test('compares corresponding lines without discarding empty or trailing lines', () => {
  assert.deepEqual(
    buildPromptDiff('Same\nOld\n\nRemoved', 'Same\nNew\nAdded'),
    [
      { live: 'Same', testing: 'Same', state: 'same' },
      { live: 'Old', testing: 'New', state: 'changed' },
      { live: '', testing: 'Added', state: 'added' },
      { live: 'Removed', testing: undefined, state: 'removed' },
    ],
  );
});

test('preserves identical empty prompts and appended lines', () => {
  assert.equal(buildPromptDiff('', '')[0].state, 'same');
  assert.deepEqual(buildPromptDiff('First', 'First\nSecond')[1], {
    live: undefined,
    testing: 'Second',
    state: 'added',
  });
});
