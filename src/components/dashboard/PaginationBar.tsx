import type { ReactNode } from 'react';
import { Button } from '@/components/ui/button';
export function PaginationBar({ summary, onPrevious, onNext, hasPrevious, hasNext, busy = false }: {
    summary: ReactNode;
    onPrevious: () => void;
    onNext: () => void;
    hasPrevious: boolean;
    hasNext: boolean;
    busy?: boolean;
}) {
    return <nav aria-label="Pagination" className="flex flex-wrap items-center justify-between gap-3 border-t py-3 text-xs text-muted-foreground"><span aria-live="polite">{summary}</span><div className="flex gap-2"><Button type="button" variant="outline" size="sm" disabled={!hasPrevious || busy} onClick={onPrevious}>Previous</Button><Button type="button" variant="outline" size="sm" disabled={!hasNext || busy} onClick={onNext}>Next</Button></div></nav>;
}
