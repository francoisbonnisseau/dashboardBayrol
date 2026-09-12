import type { ComponentProps } from 'react';
export function StatusBadge({ variant = 'neutral', className = '', ...props }: ComponentProps<'span'> & {
    variant?: 'neutral' | 'primary' | 'success' | 'warning' | 'danger' | 'info';
}) {
    return <span className={`ds-status ds-status-${variant} ${className}`} {...props}/>;
}
