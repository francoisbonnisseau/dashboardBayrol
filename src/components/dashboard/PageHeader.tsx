import type { ReactNode } from 'react';
export function PageHeader({ title, description, actions, eyebrow }: {
    title: string;
    description?: ReactNode;
    actions?: ReactNode;
    eyebrow?: string;
}) {
    return <header className="flex flex-wrap items-start justify-between gap-4">
    <div className="min-w-0">{eyebrow && <p className="mb-1 text-xs font-medium text-muted-foreground">{eyebrow}</p>}<h1 className="text-2xl font-semibold tracking-tight break-words">{title}</h1>{description && <div className="mt-1 max-w-[70ch] text-sm text-muted-foreground">{description}</div>}</div>
    {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
  </header>;
}
