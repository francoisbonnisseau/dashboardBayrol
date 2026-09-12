import { Loader2 } from 'lucide-react';
export function LoadingState({ variant = 'page', label = 'Loading…' }: {
    variant?: 'page' | 'table' | 'panel' | 'inline';
    label?: string;
}) {
    return <div role="status" aria-live="polite" className={variant === 'inline' ? 'inline-flex items-center gap-2 text-xs text-muted-foreground' : 'space-y-3 py-4'}>
    {variant === 'inline' ? <><Loader2 aria-hidden="true" className="size-4 motion-safe:animate-spin"/>{label}</> : <><span className="sr-only">{label}</span><div aria-hidden="true" className="space-y-3">{Array.from({ length: variant === 'table' ? 6 : variant === 'panel' ? 3 : 4 }, (_, i) => <div key={i} className={`rounded-md bg-muted ${variant === 'page' && i === 0 ? 'h-7 w-1/3' : 'h-9 w-full'}`}/>)}</div></>}
  </div>;
}
