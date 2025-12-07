"use client"

import * as React from "react"
import { type LucideIcon } from "lucide-react"

import {
  SidebarGroup,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar"

interface NavSecondaryProps extends React.ComponentPropsWithoutRef<typeof SidebarGroup> {
  items: {
    title: string
    icon: LucideIcon
    view?: string
    onClick?: () => void
    variant?: "default" | "destructive"
  }[]
  activeView?: string
  onViewChange?: (view: string) => void
}

export function NavSecondary({
  items,
  activeView,
  onViewChange,
  ...props
}: NavSecondaryProps) {
  return (
    <SidebarGroup {...props}>
      <SidebarGroupContent>
        <SidebarMenu>
          {items.map((item) => (
            <SidebarMenuItem key={item.title}>
              <SidebarMenuButton
                tooltip={item.title}
                isActive={item.view ? activeView === item.view : false}
                onClick={() => {
                  if (item.onClick) {
                    item.onClick()
                  } else if (item.view && onViewChange) {
                    onViewChange(item.view)
                  }
                }}
                className={item.variant === "destructive" ? "text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/20" : ""}
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
