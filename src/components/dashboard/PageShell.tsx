import type { ComponentProps } from 'react';
import { cn } from '@/lib/utils';
export function PageShell({ width = 'default', className, ...props }: ComponentProps<'div'> & {
    width?: 'default' | 'wide' | 'full';
}) {
    return <div className={cn('ds-page', { 'ds-page-default': width === 'default', 'ds-page-wide': width === 'wide' }, className)} {...props}/>;
}
