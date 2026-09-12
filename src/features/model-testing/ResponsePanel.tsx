import { formatLatencyLabel } from '@/lib/modelTestingTiming';
function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value));
}
import type { ModelResponse, ModelResponseStep } from '@/types/modelTesting';
import { cn } from '@/lib/utils';
import { getProviderFromModelId } from '@/lib/modelTestingPushLive';
import { LoadingState, StatusBadge as Badge } from '@/components/dashboard';
import { StructuredResponseContent } from '@/components/StructuredResponseContent';
import { ResponseMetrics } from './ResponseMetrics';
function getProviderLabel(provider: string) {
  switch (provider) {
    case 'openai':
      return 'OpenAI';
    case 'anthropic':
      return 'Anthropic';
    case 'google-ai':
      return 'Google';
    case 'xai':
      return 'xAI';
    case 'mistral':
      return 'Mistral';
    case 'fireworks-ai':
      return 'Fireworks';
    default:
      return provider;
  }
}

function extractAgentDisplayMessage(rawMessage: string) {
  try {
    const parsed = JSON.parse(rawMessage);
    if (
      parsed?.action === 'reply_to_user' &&
      typeof parsed.response_text === 'string'
    ) {
      return parsed.response_text;
    }

    if (
      parsed?.action === 'send_message_and_call_tool' &&
      typeof parsed.message_to_user === 'string'
    ) {
      return parsed.message_to_user;
    }

    return null;
  } catch {
    return rawMessage;
  }
}

function getRenderableResponseMessages(response: ModelResponse) {
  if (response.responseParts?.length) {
    return response.responseParts.flatMap((part) => {
      if (part.type === 'text') return [part.text];
      if (part.type === 'step_list') {
        return [
          part.steps
            .map((step) => `${step.title || ''}\n${step.text || ''}`.trim())
            .filter(Boolean)
            .join('\n'),
        ];
      }
      return [];
    });
  }

  const rawMessages = response.messages?.length
    ? response.messages
    : [response.text];

  return rawMessages
    .map((message) => extractAgentDisplayMessage(message))
    .filter((message): message is string => Boolean(message?.trim()));
}

function formatToolJson(value: unknown) {
  try {
    return JSON.stringify(value, null, 2) ?? 'undefined';
  } catch {
    return String(value);
  }
}

function getToolReadableOutput(step: ModelResponseStep) {
  if (step.toolOutput === undefined) {
    return null;
  }

  if (step.toolName === 'searchKnowledge' && isRecord(step.toolOutput)) {
    if (
      typeof step.toolOutput.debugSummary === 'string' &&
      step.toolOutput.debugSummary.trim()
    ) {
      return step.toolOutput.debugSummary;
    }

    if (typeof step.toolOutput.answer === 'string') {
      return step.toolOutput.answer;
    }
  }

  if (typeof step.toolOutput === 'string') {
    return step.toolOutput;
  }

  return formatToolJson(step.toolOutput);
}

function ToolCallStep({ step }: { step: ModelResponseStep }) {
  const readableOutput = getToolReadableOutput(step);
  const hasOutput = step.toolOutput !== undefined;
  const executedInput = step.toolInput ?? step.toolArgs ?? {};
  const inputLabel = step.toolInput ? 'Executed input' : 'Requested input';

  return (
    <details className="rounded-lg border border-border bg-muted px-3 py-3">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3">
        <div className="min-w-0">
          <span className="text-sm font-medium text-foreground">Tool call</span>
          <span className="ml-2 font-mono text-xs text-muted-foreground">
            {step.toolName}
          </span>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {typeof step.toolDurationMs === 'number' ? (
            <span className="text-xs text-muted-foreground">
              {formatLatencyLabel(step.toolDurationMs)}
            </span>
          ) : null}
          {step.toolSource === 'prefetched' ? (
            <Badge
              variant="neutral"
              className="border-info/30 bg-info/10 text-info"
            >
              Prefetched
            </Badge>
          ) : null}
          {step.toolSource === 'simulated' ? (
            <Badge
              variant="neutral"
              className="border-warning/30 bg-warning/10 text-warning"
            >
              Simulated
            </Badge>
          ) : null}
          <Badge
            variant="neutral"
            className={cn(
              'border-border bg-surface text-foreground',
              step.status === 'pending' &&
                'border-info/30 bg-info/10 text-info',
              step.status === 'completed' &&
                'border-success/30 bg-success/10 text-success',
              step.status === 'failed' &&
                'border-danger/30 bg-danger/10 text-danger',
            )}
          >
            {step.status === 'pending'
              ? 'Running'
              : step.status === 'failed'
                ? 'Failed'
                : 'Done'}
          </Badge>
        </div>
      </summary>
      <div className="mt-3 space-y-3">
        {step.thinkingMessage ? (
          <div className="rounded-md border border-info/30 bg-info/10 px-3 py-2 text-sm text-info">
            {step.thinkingMessage}
          </div>
        ) : null}
        <div>
          <div className="mb-2 text-xs font-medium uppercase tracking-[0.08em] text-muted-foreground">
            {inputLabel}
          </div>
          <pre className="max-h-44 overflow-auto rounded-md border border-border bg-surface p-3 text-xs leading-6 text-foreground">
            {formatToolJson(executedInput)}
          </pre>
        </div>

        {step.error ? (
          <div className="rounded-md border border-danger/30 bg-danger/10 px-3 py-3 text-sm leading-6 text-danger">
            {step.error}
          </div>
        ) : null}

        {hasOutput ? (
          <div>
            <div className="mb-2 text-xs font-medium uppercase tracking-[0.08em] text-muted-foreground">
              Response
            </div>
            <div className="max-h-72 overflow-auto whitespace-pre-wrap rounded-md border border-border bg-surface p-3 text-sm leading-6 text-foreground">
              {readableOutput || '[Empty response]'}
            </div>

            <details className="mt-3 rounded-md border border-border bg-surface px-3 py-2">
              <summary className="cursor-pointer text-xs font-medium uppercase tracking-[0.08em] text-muted-foreground">
                Raw JSON
              </summary>
              <pre className="mt-2 max-h-72 overflow-auto whitespace-pre-wrap break-words border-t border-border pt-2 text-xs leading-6 text-foreground">
                {formatToolJson(step.toolOutput)}
              </pre>
            </details>
          </div>
        ) : step.status === 'pending' ? (
          <div className="rounded-md border border-info/30 bg-info/10 px-3 py-3 text-sm text-info">
            Waiting for the tool response…
          </div>
        ) : null}
      </div>
    </details>
  );
}

export function ResponsePanel({
  response,
  title,
}: {
  response: ModelResponse;
  title: string;
}) {
  const messages = getRenderableResponseMessages(response);
  const steps = response.steps ?? [];

  return (
    <section className="min-w-0">
      <div className="flex items-center justify-between gap-3 px-4 py-4">
        <div className="flex items-center gap-3 min-w-0">
          <span className="truncate text-sm font-medium text-foreground">
            {title}
          </span>
        </div>
        <Badge
          variant="neutral"
          className="border-border bg-muted text-foreground"
        >
          {getProviderLabel(getProviderFromModelId(response.modelId))}
        </Badge>
      </div>

      <div className="px-4 pb-4">
        <div className="space-y-4 text-[15px] leading-7 text-foreground">
          {steps.length > 0 ? (
            steps.map((step) =>
              step.kind === 'tool_call' ? (
                <ToolCallStep key={step.id} step={step} />
              ) : step.responsePart ? (
                <StructuredResponseContent
                  key={step.id}
                  part={step.responsePart}
                />
              ) : (
                <div
                  key={step.id}
                  className={cn(
                    'whitespace-pre-wrap',
                    step.status === 'failed'
                      ? 'rounded-md border border-danger/30 bg-danger/10 px-3 py-3 text-danger'
                      : 'text-foreground',
                  )}
                >
                  {step.text}
                </div>
              ),
            )
          ) : response.responseParts?.length ? (
            response.responseParts.map((part, index) => (
              <StructuredResponseContent
                key={`${response.modelId}-part-${index}`}
                part={part}
              />
            ))
          ) : messages.length > 0 ? (
            messages.map((message, index) => (
              <div
                key={`${response.modelId}-${index}`}
                className={cn(
                  'whitespace-pre-wrap',
                  index < messages.length - 1
                    ? 'border-l-2 border-border pl-3 text-muted-foreground'
                    : 'text-foreground',
                )}
              >
                {message}
              </div>
            ))
          ) : response.error ? (
            <div className="rounded-md border border-danger/30 bg-danger/10 px-3 py-3 text-sm leading-7 text-danger">
              {response.error}
            </div>
          ) : (
            <p className="whitespace-pre-wrap">
              {response.text || (response.pending ? '' : '[Empty response]')}
            </p>
          )}

          {response.error ? (
            <div className="rounded-md border border-danger/30 bg-danger/10 px-3 py-3 text-sm leading-7 text-danger">
              Technical error: {response.error}
            </div>
          ) : null}

          {response.pending && (
            <LoadingState variant="inline" label="Thinking…" />
          )}
        </div>
      </div>

      <ResponseMetrics response={response} />
    </section>
  );
}
