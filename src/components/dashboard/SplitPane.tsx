import type { ReactNode } from 'react';
export function SplitPane({ left, right, leftHeader, rightHeader, independentScroll = false }: {
    left: ReactNode;
    right: ReactNode;
    leftHeader?: ReactNode;
    rightHeader?: ReactNode;
    independentScroll?: boolean;
}) {
    return <div className={`ds-split ${independentScroll ? 'ds-split-scroll' : ''}`}><div>{leftHeader && <div className="border-b px-3 py-2 text-sm font-semibold">{leftHeader}</div>}<div className="ds-split-body">{left}</div></div><div>{rightHeader && <div className="border-b px-3 py-2 text-sm font-semibold">{rightHeader}</div>}<div className="ds-split-body">{right}</div></div></div>;
}
