import { useId, type ReactNode } from 'react';
export function EditorSurface({ title, actions, footer, children, size = 'default' }: {
    title: string;
    actions?: ReactNode;
    footer?: ReactNode;
    children: ReactNode;
    size?: 'default' | 'compact';
}) {
    const id = useId();
    return <section aria-labelledby={id} className={`ds-editor ${size === 'compact' ? 'ds-editor-compact' : ''}`}><header className="flex flex-wrap items-center justify-between gap-2 border-b px-3 py-2"><h2 id={id} className="text-sm font-semibold">{title}</h2>{actions}</header><div className="ds-editor-content">{children}</div>{footer && <footer className="border-t px-3 py-2 text-xs text-muted-foreground">{footer}</footer>}</section>;
}
