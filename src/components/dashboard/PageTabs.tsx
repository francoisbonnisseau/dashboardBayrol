import type { ComponentProps } from 'react';
import { TabsList, TabsTrigger } from '@/components/ui/tabs';
export { Tabs as PageTabs, TabsContent as PageTabPanel } from '@/components/ui/tabs';
export function PageTabList(props: ComponentProps<typeof TabsList>) {
    return <TabsList {...props} className={`ds-tabs ${props.className ?? ''}`}/>;
}
export function PageTab(props: ComponentProps<typeof TabsTrigger>) {
    return <TabsTrigger {...props} className={`ds-tab ${props.className ?? ''}`}/>;
}
