import type { ReactNode } from 'react';
export function MetricGrid({ children, columns = 4 }: {
    children: ReactNode;
    columns?: 2 | 3 | 4;
}) {
    return <div className={`ds-metrics ds-metrics-${columns}`}>{children}</div>;
}
