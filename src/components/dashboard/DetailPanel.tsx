import { useRef, type ReactNode } from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet';
export function DetailPanel({ open, onOpenChange, title, description, children, footer, size = 'default' }: {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    title: string;
    description?: string;
    children: ReactNode;
    footer?: ReactNode;
    size?: 'default' | 'wide';
}) {
    const returnFocusRef = useRef<HTMLElement | null>(null);
    return <Sheet open={open} onOpenChange={onOpenChange}><SheetContent className={`w-full gap-0 ${size === 'wide' ? 'sm:max-w-4xl' : 'sm:max-w-xl'}`}
      onOpenAutoFocus={() => { returnFocusRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null; }}
      onCloseAutoFocus={event => { if (returnFocusRef.current?.isConnected) { event.preventDefault(); returnFocusRef.current.focus(); } }}
    ><SheetHeader className="border-b pr-12"><SheetTitle>{title}</SheetTitle><SheetDescription className={description ? '' : 'sr-only'}>{description ?? `Details for ${title}`}</SheetDescription></SheetHeader><div className="min-h-0 flex-1 overflow-y-auto p-4">{children}</div>{footer && <footer className="border-t p-4">{footer}</footer>}</SheetContent></Sheet>;
}
