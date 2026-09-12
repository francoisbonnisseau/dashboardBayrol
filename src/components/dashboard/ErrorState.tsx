import type { ReactNode } from 'react';
import { CircleAlert } from 'lucide-react';
import { Button } from '@/components/ui/button';
export function ErrorState({ title = 'Unable to load this section', description, onRetry, retrying = false, variant = 'section', id }: {
    title?: string;
    description?: ReactNode;
    onRetry?: () => void;
    retrying?: boolean;
    variant?: 'page' | 'section' | 'field';
    id?: string;
}) {
    return <div id={id} role="alert" className={`ds-error ds-error-${variant}`}><CircleAlert aria-hidden="true" className="size-4 shrink-0"/><div className="min-w-0"><p className="font-medium">{title}</p>{description && <div className="mt-1 text-sm text-muted-foreground">{description}</div>}{onRetry && <Button type="button" variant="outline" size="sm" className="mt-3" disabled={retrying} onClick={onRetry}>{retrying ? 'Retrying…' : 'Try again'}</Button>}</div></div>;
}
