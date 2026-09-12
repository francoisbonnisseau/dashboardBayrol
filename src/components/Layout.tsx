import type { ReactNode } from 'react';
import { AppSidebar } from './Sidebar';
import type { UserRole } from '@/contexts/AuthContext';
import { SidebarInset, SidebarProvider, SidebarTrigger } from '@/components/ui/sidebar';
import { Separator } from '@/components/ui/separator';
import { PageShell } from './dashboard/PageShell';
import type { DashboardView } from '@/types/views';

interface LayoutProps {
  children: ReactNode;
  activeView: DashboardView;
  onViewChange: (view: DashboardView) => void;
  userRole: UserRole;
  onLogout: () => void;
}

const viewLabels = {
  analysis: 'AI Analysis',
  intro: 'Intro',
  codeText: 'Code Text',
  testPrompts: 'Prompts',
  testModels: 'Model Testing',
} as const;

export default function Layout({ 
  children, 
  activeView, 
  onViewChange, 
  userRole, 
  onLogout 
}: LayoutProps) {
  return (
    <SidebarProvider className={activeView === 'testModels' ? 'h-dvh min-h-0 overflow-hidden' : undefined}>
      <a href="#main-content" className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-50 focus:rounded-md focus:bg-background focus:p-3">Skip to content</a>
      <AppSidebar 
        activeView={activeView}
        onViewChange={onViewChange}
        userRole={userRole}
        onLogout={onLogout}
      />
      <SidebarInset className={`min-w-0 ${activeView === 'testModels' ? 'min-h-0 overflow-hidden' : ''}`}>
        <header className="flex h-12 shrink-0 items-center gap-2 border-b px-4">
          <SidebarTrigger className="-ml-1" />
          <Separator orientation="vertical" className="mr-2 h-4" />
          <p className="text-sm font-medium capitalize">{viewLabels[activeView as keyof typeof viewLabels] || activeView}</p>
        </header>
        <div id="main-content" tabIndex={-1} className={`min-w-0 flex-1 ${activeView === 'testModels' ? 'min-h-0 overflow-hidden' : ''} ${activeView === 'analytics' ? 'bg-surface-subtle' : 'bg-background'}`}>
          <PageShell className={activeView === 'testModels' ? 'h-full min-h-0' : undefined} width={activeView === 'testModels' || activeView === 'testPrompts' ? 'full' : 'wide'}>
            {children}
          </PageShell>
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}
