"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import {
  readDashboardPreference,
  subscribeDashboardPreference,
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
  const { pathname, searchParams, isPending } = useDashboardNavigation()
  const projectId = useMemo(() => projectIdFromPath(pathname), [pathname])
  const hydratedRef = useRef(false)

  const legacySegmentId = searchParams.get("segment_id") || null
  const [segmentId, setSegmentIdState] = useState<string | null>(
    legacySegmentId
  )

  const writeFilter = useCallback(
    (next: string | null) => {
      if (projectId) {
        writeDashboardPreference(projectId, "segment_id", next ?? "")
      }
      setSegmentIdState(next)
    },
    [projectId]
  )

  const setSegmentId = useCallback(
    (next: string | null) => {
      writeFilter(next)
    },
    [writeFilter]
  )

  const clearSegmentFilter = useCallback(() => {
    writeFilter(null)
  }, [writeFilter])

  useEffect(() => {
    if (!projectId || hydratedRef.current) return

    const hasUrlFilter = searchParams.has("segment_id")

    if (hasUrlFilter) {
      writeDashboardPreference(projectId, "segment_id", legacySegmentId ?? "")
      setSegmentIdState(legacySegmentId)
      hydratedRef.current = true
      return
    }

    hydratedRef.current = true
    const saved = readDashboardPreference(projectId, "segment_id")
    if (!saved) return

    writeFilter(saved)
  }, [legacySegmentId, projectId, searchParams, writeFilter])

  useEffect(() => {
    if (!projectId) return
    return subscribeDashboardPreference(projectId, "segment_id", (value) => {
      setSegmentIdState(value || null)
    })
  }, [projectId])

  return {
    segmentId,
    setSegmentId,
    clearSegmentFilter,
    isPending,
  }
}
