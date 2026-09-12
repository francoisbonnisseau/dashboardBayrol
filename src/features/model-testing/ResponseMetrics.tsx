import type { ModelResponse } from '@/types/modelTesting';
import {
  buildTimingBreakdownTitle,
  formatLatencyLabel,
  getDisplayedLatencyMs,
} from '@/lib/modelTestingTiming';
export function ResponseMetrics({ response }: { response: ModelResponse }) {
  const usage = response.usage;
  const cost = usage ? (usage.inputCost || 0) + (usage.outputCost || 0) : null;
  return (
    <footer className="flex flex-wrap gap-x-4 gap-y-1 border-t px-3 py-2 text-xs tabular-nums text-muted-foreground">
      <span title={buildTimingBreakdownTitle(response) ?? undefined}>
        Time {formatLatencyLabel(getDisplayedLatencyMs(response))}
      </span>
      <span>
        Tokens{' '}
        {usage ? (usage.inputTokens || 0) + (usage.outputTokens || 0) : '—'}
      </span>
      <span>Cost {cost === null ? '—' : '$' + cost.toFixed(5)}</span>
      <span>Model {response.modelId}</span>
    </footer>
  );
}
