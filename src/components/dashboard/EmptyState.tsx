import type { ReactNode } from 'react';
export function EmptyState({ title, description, icon, action }: {
    title: string;
    description?: ReactNode;
    icon?: ReactNode;
    action?: ReactNode;
}) {
    return <div className="flex flex-col items-center gap-3 px-4 py-8 text-center">{icon && <span aria-hidden="true" className="text-muted-foreground [&_svg]:size-5">{icon}</span>}<div><h2 className="text-sm font-semibold">{title}</h2>{description && <div className="mt-1 max-w-[65ch] text-sm text-muted-foreground">{description}</div>}</div>{action}</div>;
}
