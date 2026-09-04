import { Code2 } from 'lucide-react';
import type { Message } from '../types';
import {
  getMessageText,
  getMessageTypeLabel,
  getStructuredMessagePayload,
  shouldShowPayloadDetails,
} from '@/lib/messagePayload';
import { MarkdownText, SourcesContent, StepListContent } from './StructuredResponseContent';

interface MessagePayloadContentProps {
  payload: Message['payload'];
}

export default function MessagePayloadContent({ payload }: MessagePayloadContentProps) {
  const text = getMessageText(payload);
  const structuredPayload = getStructuredMessagePayload(payload);

  return (
    <>
      {structuredPayload?.kind === 'step_list' && (
        <StepListContent steps={structuredPayload.steps || []} title={structuredPayload.title} />
      )}
      {structuredPayload?.kind === 'sources' && (
        <SourcesContent items={structuredPayload.items || []} title={structuredPayload.title} />
      )}
      {!structuredPayload && text && <MarkdownText text={text} />}
      {!structuredPayload && !text && (
        <div className="space-y-1">
          <div className="text-sm font-medium text-foreground">{getMessageTypeLabel(payload)}</div>
          <p className="text-xs text-muted-foreground">This message contains structured data. Expand the payload to inspect it.</p>
        </div>
      )}
      {shouldShowPayloadDetails(payload) && (
        <details className="mt-3 border-t border-current/10 pt-2">
          <summary className="flex cursor-pointer list-none items-center gap-1 text-xs font-medium text-blue-700 hover:text-blue-900">
            <Code2 className="h-3.5 w-3.5" />
            View full payload
          </summary>
          <pre className="mt-2 max-h-56 overflow-auto rounded-md bg-slate-800 p-3 text-xs leading-5 text-slate-100">
            {JSON.stringify(payload, null, 2)}
          </pre>
        </details>
      )}
    </>
  );
}
