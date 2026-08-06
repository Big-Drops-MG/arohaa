"use client"

import { createContext, useContext, type ReactNode } from "react"

export type DashboardAccessContextValue = {
  readOnly: boolean
  /** When set, traffic is locked to these utm_source values (external collaborators). */
  lockedUtmSources: string[] | null
}

const DashboardAccessContext = createContext<DashboardAccessContextValue>({
  readOnly: false,
  lockedUtmSources: null,
})

export function DashboardAccessProvider({
  children,
  value,
}: {
  children: ReactNode
  value: DashboardAccessContextValue
}) {
  return (
    <DashboardAccessContext.Provider value={value}>
      {children}
    </DashboardAccessContext.Provider>
  )
}

export function useDashboardAccess(): DashboardAccessContextValue {
  return useContext(DashboardAccessContext)
}
