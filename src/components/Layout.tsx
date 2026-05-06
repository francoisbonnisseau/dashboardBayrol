import type { ReactNode } from 'react';
import { AppSidebar } from './Sidebar';
import type { UserRole } from '@/contexts/AuthContext';
import { SidebarInset, SidebarProvider, SidebarTrigger } from '@/components/ui/sidebar';
import { Separator } from '@/components/ui/separator';
import type { DashboardView } from '@/types/views';

interface LayoutProps {
  children: ReactNode;
  activeView: DashboardView;
  onViewChange: (view: DashboardView) => void;
  userRole: UserRole;
  onLogout: () => void;
}

const viewLabels = {
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
    <SidebarProvider>
      <AppSidebar 
        activeView={activeView}
        onViewChange={onViewChange}
        userRole={userRole}
        onLogout={onLogout}
      />
      <SidebarInset>
        <header className="flex h-16 shrink-0 items-center gap-2 border-b px-4">
          <SidebarTrigger className="-ml-1" />
          <Separator orientation="vertical" className="mr-2 h-4" />
          <h1 className="text-lg font-semibold capitalize">{viewLabels[activeView as keyof typeof viewLabels] || activeView}</h1>
        </header>
        <main className="flex-1 overflow-y-auto bg-slate-50/50 dark:bg-slate-950/50">
          <div className="container mx-auto p-6 max-w-7xl animate-in fade-in duration-500">
            {children}
          </div>
        </main>
      </SidebarInset>
    </SidebarProvider>
  );
}
