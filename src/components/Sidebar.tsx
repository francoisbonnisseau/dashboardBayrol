"use client"

import * as React from "react"
import { 
  Settings as SettingsIcon, 
  BarChart3, 
  Brain, 
  BookOpen, 
  FileText, 
  MessageSquare, 
  LineChart
} from 'lucide-react';
import type { UserRole } from '@/contexts/AuthContext';
import bayrolIcon from '/iconBayrol.png';

import { NavMain } from "@/components/nav-main"
import { NavKnowledge } from "@/components/nav-knowledge"
import { NavSecondary } from "@/components/nav-secondary"
import {
  Sidebar,
  SidebarContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar"

type ViewType = 'conversations' | 'sentiment' | 'feedbacks' | 'settings' | 'analysis' | 'learnings' | 'intro' | 'analytics';

interface AppSidebarProps extends React.ComponentProps<typeof Sidebar> {
  activeView: ViewType;
  onViewChange: (view: ViewType) => void;
  userRole: UserRole;
  onLogout: () => void;
}

export function AppSidebar({ 
  activeView, 
  onViewChange, 
  userRole, 
  onLogout,
  ...props
}: AppSidebarProps) {
  
  const navMainItems = [
    {
      title: "Sentiment",
      icon: BarChart3,
      view: "sentiment",
    },
    {
      title: "Analytics",
      icon: LineChart,
      view: "analytics",
    },
    {
      title: "Feedbacks",
      icon: MessageSquare,
      view: "feedbacks",
    },
  ]

  const navKnowledgeItems = [
    {
      title: "Learnings",
      icon: BookOpen,
      view: "learnings",
    },
    {
      title: "Intro",
      icon: FileText,
      view: "intro",
    },
    ...(userRole === 'admin' ? [{
      title: "AI Analysis",
      icon: Brain,
      view: "analysis",
    }] : []),
  ]

  const navSecondaryItems = [
    {
      title: "Settings",
      icon: SettingsIcon,
      view: "settings",
    },
  ]

  return (
    <Sidebar collapsible="icon" {...props}>
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              size="lg"
              className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
            >
              <div className="flex aspect-square size-8 items-center justify-center rounded-lg overflow-hidden">
                <img src={bayrolIcon} alt="Bayrol" className="size-8 object-contain" />
              </div>
              <div className="grid flex-1 text-left text-sm leading-tight">
                <span className="truncate font-semibold">Bayrol</span>
                <span className="truncate text-xs text-muted-foreground">Dashboard</span>
              </div>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        <NavMain 
          items={navMainItems} 
          activeView={activeView}
          onViewChange={(view) => onViewChange(view as ViewType)}
        />
        <NavKnowledge 
          items={navKnowledgeItems} 
          activeView={activeView}
          onViewChange={(view) => onViewChange(view as ViewType)}
        />
        <NavSecondary 
          items={navSecondaryItems} 
          activeView={activeView}
          onViewChange={(view) => onViewChange(view as ViewType)}
          className="mt-auto" 
        />
      </SidebarContent>
    </Sidebar>
  )
}
