import type { ReactNode } from 'react';
import { EmptyState } from './EmptyState';
import { LoadingState } from './LoadingState';
export function DataTableShell({ children, label, toolbar, pagination, loading = false, refreshing = false, empty = false, emptyState, error, stickyHeader = false }: {
    children: ReactNode;
    label: string;
    toolbar?: ReactNode;
    pagination?: ReactNode;
    loading?: boolean;
    refreshing?: boolean;
    empty?: boolean;
    emptyState?: ReactNode;
    error?: ReactNode;
    stickyHeader?: boolean;
}) {
    return <section aria-label={label} className="ds-data-table">{toolbar}<div aria-busy={loading || refreshing}>{error ?? (loading ? <LoadingState variant="table"/> : empty ? (emptyState ?? <EmptyState title="No results" />) : <div role="region" aria-label={`${label} rows`} tabIndex={0} className={`ds-table-scroll ${stickyHeader ? 'ds-table-sticky' : ''}`}>{children}</div>)}</div>{refreshing && !loading && <div className="border-t px-3 py-2"><LoadingState variant="inline" label="Updating results…"/></div>}{pagination}</section>;
}
