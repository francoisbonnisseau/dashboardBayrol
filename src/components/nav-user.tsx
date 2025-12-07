"use client"

import {
  LogOut,
  User,
} from "lucide-react"

import {
  Avatar,
  AvatarFallback,
} from "@/components/ui/avatar"
import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar"
import type { UserRole } from "@/contexts/AuthContext"

interface NavUserProps {
  userRole: UserRole
  onLogout: () => void
}

export function NavUser({ userRole, onLogout }: NavUserProps) {
  const displayRole = userRole === 'admin' ? 'Administrator' : 'User'

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <SidebarMenuButton
          size="lg"
          className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
        >
          <Avatar className="h-8 w-8 rounded-lg">
            <AvatarFallback className="rounded-lg">
              <User className="h-4 w-4" />
            </AvatarFallback>
          </Avatar>
          <div className="grid flex-1 text-left text-sm leading-tight">
            <span className="truncate font-semibold">{displayRole}</span>
            <span className="truncate text-xs text-muted-foreground">Bayrol Dashboard</span>
          </div>
        </SidebarMenuButton>
      </SidebarMenuItem>
      <SidebarMenuItem>
        <SidebarMenuButton
          tooltip="Logout"
          onClick={onLogout}
          className="text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/20"
        >
          <LogOut />
          <span>Logout</span>
        </SidebarMenuButton>
      </SidebarMenuItem>
    </SidebarMenu>
  )
}
