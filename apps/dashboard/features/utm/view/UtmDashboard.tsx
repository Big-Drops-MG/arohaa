"use client"

import { useCallback, useState } from "react"
import { cn } from "@workspace/ui/lib/utils"
import type { UtmDashboardData } from "@/features/utm/model/utm"
import { getUtmEmptyDashboardData } from "@/features/utm/controller/utm-empty-data"
import { UtmOverviewCards } from "@/features/utm/view/UtmOverviewCards"
import { UtmParamsColumns } from "@/features/utm/view/UtmParamsColumns"

type UtmDashboardProps = {
  data: UtmDashboardData
  projectId: string
  isActive?: boolean
}

export function UtmDashboard({
  data: initialData,
  projectId,
  isActive = true,
}: UtmDashboardProps) {
  const [dashboardData, setDashboardData] = useState(initialData)
  const [isLoading, setIsLoading] = useState(false)

  const refresh = useCallback(async () => {
    if (!isActive) return
    setIsLoading(true)
    try {
      const res = await fetch(
        `/api/landing-pages/${encodeURIComponent(projectId)}/utm`,
        { cache: "no-store" }
      )
      if (!res.ok) {
        setDashboardData(
          getUtmEmptyDashboardData(projectId, initialData.brandName)
        )
        return
      }
      setDashboardData((await res.json()) as UtmDashboardData)
    } catch {
      setDashboardData(
        getUtmEmptyDashboardData(projectId, initialData.brandName)
      )
    } finally {
      setIsLoading(false)
    }
  }, [initialData.brandName, isActive, projectId])

  return (
    <div
      className={cn(
        "flex flex-col gap-6 px-6 pb-6 lg:px-8",
        isLoading && "pointer-events-none opacity-60"
      )}
      aria-busy={isLoading}
    >
      <div className="flex flex-col gap-1 border-b border-border pb-4">
        <h1 className="text-xl font-semibold text-foreground">UTM</h1>
        <p className="text-sm text-muted-foreground">
          Manage allowed and blocked UTM parameters for{" "}
          {dashboardData.brandName}.
        </p>
      </div>

      <UtmOverviewCards stats={dashboardData.stats} />

      <UtmParamsColumns
        projectId={projectId}
        data={dashboardData}
        onDataChange={(next) => {
          setDashboardData(next)
          void refresh()
        }}
      />
    </div>
  )
}
