// Keep the existing positional comparison semantics: align corresponding lines,
// rather than treating moved text as a new version or changing publishing data.
export function buildPromptDiff(live: string, testing: string) {
  const left = live.split('\n');
  const right = testing.split('\n');
  return Array.from(
    { length: Math.max(left.length, right.length) },
    (_, index) => {
      const liveLine = left[index];
      const testingLine = right[index];
      const state =
        liveLine === testingLine
          ? 'same'
          : !liveLine && testingLine
            ? 'added'
            : liveLine && !testingLine
              ? 'removed'
              : 'changed';
      return { live: liveLine, testing: testingLine, state };
    },
  );
}
