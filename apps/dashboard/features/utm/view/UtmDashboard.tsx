"use client"

import { useCallback, useState } from "react"
import { UtmDashboardSkeleton } from "@/features/dashboard/view/dashboard-skeletons"
import type { UtmDashboardData } from "@/features/utm/model/utm"
import { getUtmEmptyDashboardData } from "@/features/utm/controller/utm-empty-data"
import { UtmOverviewCards } from "@/features/utm/view/UtmOverviewCards"
import { UtmParamsColumns } from "@/features/utm/view/UtmParamsColumns"

type UtmDashboardProps = {
  data: UtmDashboardData
  projectId: string
  isActive?: boolean
  isLoading?: boolean
  readOnly?: boolean
}

export function UtmDashboard({
  data: initialData,
  projectId,
  isActive = true,
  isLoading: isTabLoading = false,
  readOnly: _readOnly = false,
}: UtmDashboardProps) {
  const [dashboardData, setDashboardData] = useState(initialData)
  const [isFetching, setIsFetching] = useState(false)

  const refresh = useCallback(async () => {
    if (!isActive) return
    setIsFetching(true)
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
      setIsFetching(false)
    }
  }, [initialData.brandName, isActive, projectId])

  const showSkeleton = isTabLoading || isFetching

  return (
    <div className="flex flex-col gap-6 pb-6">
      <div className="flex flex-col gap-1 border-b border-border pb-4">
        <h1 className="text-xl font-semibold text-foreground">UTM Control</h1>
        <p className="text-sm text-muted-foreground">
          Block unwanted UTM traffic for {dashboardData.brandName}. Blocked
          visitors are redirected to{" "}
          <code className="text-xs">/access-denied</code> on your landing page
          and are excluded from analytics.
        </p>
      </div>

      {showSkeleton ? (
        <UtmDashboardSkeleton />
      ) : (
        <>
          <UtmOverviewCards data={dashboardData} />

          <UtmParamsColumns
            projectId={projectId}
            data={dashboardData}
            onDataChange={(next) => {
              setDashboardData(next)
              void refresh()
            }}
          />
        </>
      )}
    </div>
  )
}
