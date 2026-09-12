import type { ReactNode } from 'react';
export function Metric({ label, value, helper, icon }: {
    label: string;
    value: ReactNode;
    helper?: ReactNode;
    icon?: ReactNode;
}) {
    return <dl className="min-w-0 px-4 py-4"><dt className="flex items-center gap-2 text-xs font-medium text-muted-foreground">{icon && <span aria-hidden="true" className="[&_svg]:size-4">{icon}</span>}{label}</dt><dd className="mt-2 text-2xl font-semibold tabular-nums tracking-tight">{value}</dd>{helper && <dd className="mt-1 text-xs text-muted-foreground">{helper}</dd>}</dl>;
}
