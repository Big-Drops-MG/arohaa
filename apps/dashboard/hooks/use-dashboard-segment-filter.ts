"use client"

import { useCallback, useEffect, useMemo, useRef } from "react"
import {
  readDashboardPreference,
  writeDashboardPreference,
} from "@/lib/dashboard/dashboard-preferences"
import { useDashboardNavigation } from "@/hooks/use-dashboard-navigation"

function projectIdFromPath(pathname: string): string | null {
  const parts = pathname.split("/").filter(Boolean)
  const idx = parts.indexOf("dashboard")
  if (idx < 0) return null
  const id = parts[idx + 1]
  if (!id || id === "new-landing" || id === "ops") return null
  return id
}

export function useDashboardSegmentFilter() {
  const { pathname, searchParams, replaceSearch, isPending } =
    useDashboardNavigation()
  const projectId = useMemo(() => projectIdFromPath(pathname), [pathname])
  const hydratedRef = useRef(false)

  const segmentId = useMemo(
    () => searchParams.get("segment_id") || null,
    [searchParams]
  )

  const writeFilter = useCallback(
    (next: string | null, refresh = true) => {
      if (projectId) {
        writeDashboardPreference(projectId, "segment_id", next ?? "")
      }

      replaceSearch(
        (params) => {
          if (next) params.set("segment_id", next)
          else params.delete("segment_id")
        },
        { refresh }
      )
    },
    [projectId, replaceSearch]
  )

  const setSegmentId = useCallback(
    (next: string | null) => {
      writeFilter(next, true)
    },
    [writeFilter]
  )

  const clearSegmentFilter = useCallback(() => {
    writeFilter(null, true)
  }, [writeFilter])

  useEffect(() => {
    if (!projectId || hydratedRef.current) return

    const hasUrlFilter = searchParams.has("segment_id")

    if (hasUrlFilter) {
      writeDashboardPreference(projectId, "segment_id", segmentId ?? "")
      hydratedRef.current = true
      return
    }

    hydratedRef.current = true
    const saved = readDashboardPreference(projectId, "segment_id")
    if (!saved) return

    writeFilter(saved, false)
  }, [projectId, searchParams, segmentId, writeFilter])

  return {
    segmentId,
    setSegmentId,
    clearSegmentFilter,
    isPending,
  }
}
