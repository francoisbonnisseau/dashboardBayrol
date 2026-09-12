import type { ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { Toolbar } from './Toolbar';
export function FilterBar({ children, onReset, resetDisabled = false }: {
    children: ReactNode;
    onReset?: () => void;
    resetDisabled?: boolean;
}) {
    return <Toolbar label="Filters" actions={onReset && <Button type="button" variant="ghost" size="sm" disabled={resetDisabled} onClick={onReset}>Reset filters</Button>}>{children}</Toolbar>;
}
