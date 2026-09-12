import { EditorSurface, SplitPane } from '@/components/dashboard';
import { buildPromptDiff } from './promptDiff';
export function PromptCompare({
  live,
  testing,
}: {
  live: string;
  testing: string;
}) {
  const rows = buildPromptDiff(live, testing);
  const pane = (side: 'live' | 'testing') => (
    <EditorSurface title={side === 'live' ? 'Live' : 'Testing'}>
      {rows.map((row, index) => (
        <div
          key={index}
          className={`grid grid-cols-[3rem_minmax(0,1fr)] px-2 py-1 text-xs leading-5 ${row.state === 'same' ? '' : row.state === 'changed' ? 'bg-warning/10' : row.state === 'added' ? 'bg-success/10' : 'bg-danger/10'}`}
        >
          <span
            aria-hidden="true"
            className="pr-3 text-right text-muted-foreground"
          >
            {row[side] === undefined ? '' : index + 1}
          </span>
          <span className="whitespace-pre-wrap break-words">
            <span className="sr-only">
              {row.state !== 'same' ? row.state + ': ' : ''}
            </span>
            {row[side] || ' '}
          </span>
        </div>
      ))}
    </EditorSurface>
  );
  return <SplitPane left={pane('live')} right={pane('testing')} />;
}
