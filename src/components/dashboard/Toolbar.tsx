import type { ReactNode } from 'react';
export function Toolbar({ children, actions, label = 'Page controls' }: {
    children?: ReactNode;
    actions?: ReactNode;
    label?: string;
}) {
    return <div role="group" aria-label={label} className="ds-toolbar"><div className="flex min-w-0 flex-wrap items-center gap-2">{children}</div>{actions && <div className="flex flex-wrap items-center gap-2 sm:ml-auto">{actions}</div>}</div>;
}
