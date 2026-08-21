"use client"

import type { ReactNode } from "react"
import { Suspense } from "react"
import { DashboardNavigationProvider } from "@/hooks/use-dashboard-navigation"
import { DashboardActivityTracker } from "@/features/dashboard/view/DashboardActivityTracker"

export function DashboardNavigationShell({
  children,
}: {
  children: ReactNode
}) {
  return (
    <DashboardNavigationProvider>
      <Suspense fallback={null}>
        <DashboardActivityTracker />
      </Suspense>
      {children}
    </DashboardNavigationProvider>
  )
}
