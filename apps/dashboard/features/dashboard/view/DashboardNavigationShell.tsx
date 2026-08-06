"use client"

import type { ReactNode } from "react"
import { DashboardNavigationProvider } from "@/hooks/use-dashboard-navigation"

export function DashboardNavigationShell({
  children,
}: {
  children: ReactNode
}) {
  return <DashboardNavigationProvider>{children}</DashboardNavigationProvider>
}
