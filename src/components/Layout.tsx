import { ReactNode } from 'react';
import { AppSidebar } from './Sidebar';
import type { UserRole } from '@/contexts/AuthContext';
import { SidebarInset, SidebarProvider, SidebarTrigger } from '@/components/ui/sidebar';
import { Separator } from '@/components/ui/separator';

interface LayoutProps {
  children: ReactNode;
  activeView: 'conversations' | 'sentiment' | 'feedbacks' | 'settings' | 'analysis' | 'learnings' | 'intro' | 'analytics';
  onViewChange: (view: 'conversations' | 'sentiment' | 'feedbacks' | 'settings' | 'analysis' | 'learnings' | 'intro' | 'analytics') => void;
  userRole: UserRole;
  onLogout: () => void;
}

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
          <h1 className="text-lg font-semibold capitalize">{activeView === 'intro' ? 'Intro' : activeView}</h1>
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
