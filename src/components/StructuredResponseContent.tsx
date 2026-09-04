import ReactMarkdown from 'react-markdown';
import { BookOpen, FileText, ListChecks } from 'lucide-react';
import type { AgentResponsePart, SourceItem, StepListItem } from '@/types/structuredMessage';
import { isSafeHttpUrl } from '@/lib/messagePayload';

export function MarkdownText({ text }: { text: string }) {
  return (
    <div className="message-markdown text-sm leading-6">
      <ReactMarkdown
        components={{
          a: ({ ...props }) => (
            <a
              {...props}
              target="_blank"
              rel="noreferrer"
              className="font-medium text-blue-700 underline underline-offset-2 hover:text-blue-900"
            />
          ),
          img: ({ ...props }) => (
            <img
              {...props}
              alt={props.alt || ''}
              loading="lazy"
              className="my-2 max-h-56 max-w-full rounded-md object-contain"
            />
          ),
        }}
      >
        {text}
      </ReactMarkdown>
    </div>
  );
}

export function StepListContent({ steps, title }: { steps: StepListItem[]; title?: string }) {
  return (
    <section aria-label={title || 'Step-by-step guide'} className="space-y-3">
      <div className="flex items-center gap-2 text-sm font-semibold text-green-900">
        <ListChecks className="h-4 w-4 shrink-0" />
        <span>{title || 'Step-by-step guide'}</span>
        <span className="text-xs font-normal text-green-700">{steps.length} steps</span>
      </div>
      <ol className="space-y-3">
        {steps.map((step, index) => (
          <li key={`${step.title || 'step'}-${index}`} className="relative pl-8">
            <span className="absolute left-0 top-0.5 flex h-5 w-5 items-center justify-center rounded-full bg-green-100 text-xs font-semibold text-green-800">
              {index + 1}
            </span>
            <div className="space-y-1">
              {step.title && <h4 className="text-sm font-semibold text-foreground">{step.title}</h4>}
              {step.text && <MarkdownText text={step.text} />}
            </div>
          </li>
        ))}
      </ol>
    </section>
  );
}

function SourceItemContent({ item }: { item: SourceItem }) {
  const title = item.title || item.docName || 'Untitled source';
  const safeUrl = isSafeHttpUrl(item.url) ? item.url : undefined;
  const sourceBody = (
    <div className="flex min-w-0 gap-3">
      {item.picture && isSafeHttpUrl(item.picture) ? (
        <img src={item.picture} alt="" loading="lazy" className="h-12 w-12 shrink-0 rounded-md object-cover" />
      ) : (
        <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-md bg-blue-50 text-blue-700">
          <FileText className="h-5 w-5" />
        </span>
      )}
      <div className="min-w-0 space-y-1">
        <div className="break-words text-sm font-semibold text-foreground">{title}</div>
        {item.docName && item.docName !== title && (
          <div className="break-words text-xs text-muted-foreground">{item.docName}</div>
        )}
        {item.description && <MarkdownText text={item.description} />}
        {safeUrl && <div className="text-xs font-medium text-blue-700">Open source ↗</div>}
      </div>
    </div>
  );

  return (
    <li className="border-t border-green-200/70 py-3 first:border-t-0 first:pt-0 last:pb-0">
      {safeUrl ? (
        <a
          href={safeUrl}
          target="_blank"
          rel="noreferrer"
          className="block rounded-md outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
        >
          {sourceBody}
        </a>
      ) : (
        sourceBody
      )}
    </li>
  );
}

export function SourcesContent({ items, title }: { items: SourceItem[]; title?: string }) {
  return (
    <section aria-label={title || 'Sources'} className="space-y-3">
      <div className="flex items-center gap-2 text-sm font-semibold text-green-900">
        <BookOpen className="h-4 w-4 shrink-0" />
        <span>{title || 'Sources'}</span>
        <span className="text-xs font-normal text-green-700">{items.length}</span>
      </div>
      {items.length > 0 ? (
        <ul className="space-y-0">
          {items.map((item, index) => (
            <SourceItemContent key={`${item.url || item.title || 'source'}-${index}`} item={item} />
          ))}
        </ul>
      ) : (
        <p className="text-sm text-muted-foreground">No source details available.</p>
      )}
    </section>
  );
}

export function StructuredResponseContent({ part }: { part: AgentResponsePart }) {
  if (part.type === 'text') {
    return <MarkdownText text={part.text} />;
  }

  if (part.type === 'step_list') {
    return <StepListContent steps={part.steps} />;
  }

  return <SourcesContent items={part.items} title={part.title} />;
}
