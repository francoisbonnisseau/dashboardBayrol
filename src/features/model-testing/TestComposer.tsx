import { useEffect, useRef } from 'react';
import { ArrowUp, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';

export function TestComposer({
  value, onChange, onRun, running, disabled, compare,
}: {
  value: string;
  onChange: (value: string) => void;
  onRun: () => void;
  running: boolean;
  disabled: boolean;
  compare: boolean;
}) {
  const inputRef = useRef<HTMLTextAreaElement>(null);
  useEffect(() => {
    const input = inputRef.current;
    if (!input) return;
    input.style.height = 'auto';
    input.style.height = Math.min(input.scrollHeight, 200) + 'px';
  }, [value]);
  return (
    <form onSubmit={(event) => { event.preventDefault(); if (!disabled) onRun(); }}>
      <div className="rounded-2xl border border-input bg-surface p-3 transition-colors focus-within:border-ring">
        <Textarea
          id="model-testing-message"
          ref={inputRef}
          aria-label="User message"
          value={value}
          onChange={(event) => onChange(event.target.value)}
          readOnly={running}
          rows={2}
          className="min-h-14 resize-none border-0 bg-transparent px-2 py-1 text-[15px] leading-7 shadow-none focus-visible:ring-0"
          onKeyDown={(event) => {
            if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) {
              event.preventDefault();
              if (!disabled) onRun();
            }
          }}
          placeholder={compare ? 'Send a message to both models…' : 'Message the assistant…'}
        />
        <div className="mt-2 flex items-center justify-between gap-3">
          <span className="px-2 text-xs text-muted-foreground">
            {compare ? 'Comparing two models' : 'Follow-up questions welcome'}
          </span>
          <Button type="submit" size="icon" className="shrink-0 rounded-full" disabled={disabled}
            aria-label={running ? 'Generating response' : compare ? 'Send to both models' : 'Send message'}>
            {running ? <Loader2 className="size-4 animate-spin motion-reduce:animate-none" /> : <ArrowUp className="size-5" />}
          </Button>
        </div>
      </div>
      <p className="py-2 text-center text-[11px] text-muted-foreground">
        Enter to send · Shift+Enter for a new line
      </p>
    </form>
  );
}
