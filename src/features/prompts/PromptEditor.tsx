import { EditorSurface } from '@/components/dashboard';
import { Textarea } from '@/components/ui/textarea';
export function PromptEditor({
  value,
  onChange,
  disabled,
}: {
  value: string;
  onChange: (value: string) => void;
  disabled: boolean;
}) {
  return (
    <EditorSurface title="Prompt">
      <Textarea
        aria-label="Prompt body"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        disabled={disabled}
        spellCheck={false}
        className="min-h-[55vh] resize-y rounded-none border-0 font-mono text-sm leading-6 shadow-none"
      />
    </EditorSurface>
  );
}
