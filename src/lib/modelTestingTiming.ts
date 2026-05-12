import type { ModelResponse } from '../types/modelTesting.ts';

export function formatLatencyLabel(latencyMs: number) {
  return `${(latencyMs / 1000).toFixed(1).replace('.', ',')} s`;
}

export function getDisplayedLatencyMs(response: ModelResponse) {
  return response.timing?.totalMs ?? response.latencyMs;
}

export function buildTimingBreakdownTitle(response: ModelResponse) {
  if (!response.timing) {
    return null;
  }

  const lines = [`Total: ${formatLatencyLabel(response.timing.totalMs)}`];
  for (const segment of response.timing.segments) {
    lines.push(`${segment.label}: ${formatLatencyLabel(segment.durationMs)}`);
  }

  return lines.join('\n');
}
