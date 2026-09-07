"use client"

import { useCallback, useEffect, useRef, useState } from "react"
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

function utmDataSignature(data: UtmDashboardData): string {
  return [
    data.brandName,
    data.stats.total,
    data.stats.activeSource,
    data.stats.activeS1,
    data.stats.blockedSource,
    data.stats.blockedS1,
    data.activeItems.length,
    data.blockedItems.length,
    data.activeTruncated ? "1" : "0",
  ].join("|")
}

export function UtmDashboard({
  data: initialData,
  projectId,
  isActive = true,
  isLoading: isTabLoading = false,
  readOnly = false,
}: UtmDashboardProps) {
  const [dashboardData, setDashboardData] = useState(initialData)
  const [isFetching, setIsFetching] = useState(false)
  const [loadError, setLoadError] = useState<string | null>(null)
  const syncedSignatureRef = useRef(utmDataSignature(initialData))

  // Lazy tab fetch updates the parent `data` prop after mount; sync local state.
  useEffect(() => {
    const nextSignature = utmDataSignature(initialData)
    if (nextSignature === syncedSignatureRef.current) return
    syncedSignatureRef.current = nextSignature
    setDashboardData(initialData)
    setLoadError(null)
  }, [initialData])

  const refresh = useCallback(async () => {
    if (!isActive) return
    setIsFetching(true)
    setLoadError(null)
    try {
      const res = await fetch(
        `/api/landing-pages/${encodeURIComponent(projectId)}/utm`,
        { cache: "no-store" }
      )
      if (!res.ok) {
        setLoadError("Could not load UTM controls. Try refreshing.")
        setDashboardData(
          getUtmEmptyDashboardData(projectId, initialData.brandName)
        )
        return
      }
      const next = (await res.json()) as UtmDashboardData
      syncedSignatureRef.current = utmDataSignature(next)
      setDashboardData(next)
    } catch {
      setLoadError("Could not load UTM controls. Try refreshing.")
      setDashboardData(
        getUtmEmptyDashboardData(projectId, initialData.brandName)
      )
    } finally {
      setIsFetching(false)
    }
  }, [initialData.brandName, isActive, projectId])

  const showSkeleton = isTabLoading || isFetching
  const brandLabel = dashboardData.brandName.trim() || "this landing page"

  return (
    <div className="flex flex-col gap-6 pb-6">
      <div className="flex flex-col gap-1 border-b border-border pb-4">
        <h1 className="text-xl font-semibold text-foreground">UTM Control</h1>
        <p className="text-sm text-muted-foreground">
          Block unwanted UTM traffic for {brandLabel}. Blocked visitors are
          redirected to <code className="text-xs">/access-denied</code> on your
          landing page and are excluded from analytics.
        </p>
        {loadError ? (
          <p className="text-sm text-destructive">{loadError}</p>
        ) : null}
      </div>

      {showSkeleton ? (
        <UtmDashboardSkeleton />
      ) : (
        <>
          <UtmOverviewCards data={dashboardData} />

          <UtmParamsColumns
            projectId={projectId}
            data={dashboardData}
            readOnly={readOnly}
            onDataChange={(next) => {
              syncedSignatureRef.current = utmDataSignature(next)
              setDashboardData(next)
              void refresh()
            }}
          />
        </>
      )}
    </div>
  )
}
