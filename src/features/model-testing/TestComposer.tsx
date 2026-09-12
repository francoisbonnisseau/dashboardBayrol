import { EditorSurface, LoadingState } from '@/components/dashboard';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';

export function TestComposer({
  value,
  onChange,
  onRun,
  running,
  disabled,
  compare,
}: {
  value: string;
  onChange: (value: string) => void;
  onRun: () => void;
  running: boolean;
  disabled: boolean;
  compare: boolean;
}) {
  return (
    <EditorSurface
      title="Prompt"
      size="compact"
      footer={
        <div className="flex flex-wrap items-center justify-between gap-3">
          <span>
            {compare
              ? 'The same user message is sent to both models.'
              : 'Conversation history is preserved for this model.'}{' '}
            Shift+Enter adds a line.
          </span>
          <Button onClick={onRun} disabled={disabled}>
            {running ? (
              <LoadingState variant="inline" label="Running…" />
            ) : compare ? (
              'Run Comparison'
            ) : (
              'Run'
            )}
          </Button>
        </div>
      }
    >
      <Textarea
        aria-label="User message"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        disabled={running}
        onKeyDown={(event) => {
          if (
            event.key === 'Enter' &&
            !event.shiftKey &&
            !event.nativeEvent.isComposing
          ) {
            event.preventDefault();
            if (!disabled) onRun();
          }
        }}
        placeholder="How should I treat cloudy pool water?"
      />
    </EditorSurface>
  );
}
