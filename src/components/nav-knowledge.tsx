"use client"

import { type LucideIcon } from "lucide-react"

import {
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar"

interface NavKnowledgeProps {
  items: {
    title: string
    icon: LucideIcon
    view: string
  }[]
  activeView: string
  onViewChange: (view: string) => void
}

export function NavKnowledge({ items, activeView, onViewChange }: NavKnowledgeProps) {
  return (
    <SidebarGroup>
      <SidebarGroupLabel>Knowledge</SidebarGroupLabel>
      <SidebarGroupContent>
        <SidebarMenu>
          {items.map((item) => (
            <SidebarMenuItem key={item.title}>
              <SidebarMenuButton
                tooltip={item.title}
                isActive={activeView === item.view}
                onClick={() => onViewChange(item.view)}
              >
                <item.icon />
                <span>{item.title}</span>
              </SidebarMenuButton>
            </SidebarMenuItem>
          ))}
        </SidebarMenu>
      </SidebarGroupContent>
    </SidebarGroup>
  )
}
