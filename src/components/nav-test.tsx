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

interface NavTestProps {
  items: {
    title: string
    icon: LucideIcon
    view: string
  }[]
  activeView: string
  onViewChange: (view: string) => void
}

export function NavTest({ items, activeView, onViewChange }: NavTestProps) {
  return (
    <SidebarGroup>
      <SidebarGroupLabel className="flex items-center gap-2">
        <span>Test</span>
        <span className="rounded-full border border-amber-300 bg-amber-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-amber-800">
          Preview
        </span>
      </SidebarGroupLabel>
      <SidebarGroupContent>
        <SidebarMenu>
          {items.map((item) => {
            const isDisabled = false //item.view === "testModels"

            return (
              <SidebarMenuItem key={item.title}>
                <SidebarMenuButton
                  tooltip={isDisabled ? `${item.title} (Preview only)` : item.title}
                  isActive={!isDisabled && activeView === item.view}
                  disabled={isDisabled}
                  aria-disabled={isDisabled}
                  onClick={() => {
                    if (!isDisabled) {
                      onViewChange(item.view)
                    }
                  }}
                  className={isDisabled ? "text-muted-foreground opacity-50" : undefined}
                >
                  <item.icon />
                  <span>{item.title}</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
            )
          })}
        </SidebarMenu>
      </SidebarGroupContent>
    </SidebarGroup>
  )
}
