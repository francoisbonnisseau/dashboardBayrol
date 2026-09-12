import { useId, type ReactNode } from 'react';
export function Section({ title, description, actions, children, variant = 'plain', className = '' }: {
    title: string;
    description?: ReactNode;
    actions?: ReactNode;
    children: ReactNode;
    variant?: 'plain' | 'surface';
    className?: string;
}) {
    const id = useId();
    return <section aria-labelledby={id} className={`${variant === 'surface' ? 'min-w-0 rounded-xl border bg-surface p-5 sm:p-6' : 'border-t pt-6'} space-y-3 ${className}`}><header className="flex flex-wrap items-start justify-between gap-3"><div><h2 id={id} className="text-base font-semibold">{title}</h2>{description && <div className="mt-1 max-w-[70ch] text-sm text-muted-foreground">{description}</div>}</div>{actions}</header>{children}</section>;
}
