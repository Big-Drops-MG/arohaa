"use client"

import { useCallback, useEffect, useMemo, useRef } from "react"
import type { OverviewDateRangeId } from "@/features/overview/model/overview"
import {
  parseDashboardCustomRange,
  parseTrafficRangeId,
  type DashboardCustomRange,
} from "@/features/traffic/model/traffic-range"
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

export function useDashboardDateRange() {
  const { pathname, searchParams, replaceSearch, isPending } =
    useDashboardNavigation()
  const projectId = useMemo(() => projectIdFromPath(pathname), [pathname])
  const hydratedRef = useRef(false)

  const dateRangeId = useMemo(
    () => parseTrafficRangeId(searchParams.get("range_id")),
    [searchParams]
  )

  const customRange = useMemo(() => {
    if (dateRangeId !== "custom") return undefined
    return parseDashboardCustomRange(
      searchParams.get("from"),
      searchParams.get("to")
    )
  }, [dateRangeId, searchParams])

  const persist = useCallback(
    (rangeId: OverviewDateRangeId, custom?: DashboardCustomRange) => {
      if (!projectId) return
      writeDashboardPreference(projectId, "range_id", rangeId)
      if (rangeId === "custom" && custom) {
        writeDashboardPreference(projectId, "range_from", custom.from)
        writeDashboardPreference(projectId, "range_to", custom.to)
      }
    },
    [projectId]
  )

  const setDateRangeId = useCallback(
    (nextRangeId: OverviewDateRangeId) => {
      if (nextRangeId === "custom") return
      if (nextRangeId === dateRangeId) return

      persist(nextRangeId)
      replaceSearch((params) => {
        params.set("range_id", nextRangeId)
        params.delete("from")
        params.delete("to")
      })
    },
    [dateRangeId, persist, replaceSearch]
  )

  const setCustomRange = useCallback(
    (next: DashboardCustomRange) => {
      persist("custom", next)
      replaceSearch((params) => {
        params.set("range_id", "custom")
        params.set("from", next.from)
        params.set("to", next.to)
      })
    },
    [persist, replaceSearch]
  )

  useEffect(() => {
    if (!projectId || hydratedRef.current) return

    if (searchParams.has("range_id")) {
      persist(dateRangeId, customRange)
      hydratedRef.current = true
      return
    }

    hydratedRef.current = true
    const savedId = readDashboardPreference(projectId, "range_id")
    if (!savedId) return
    const rangeId = parseTrafficRangeId(savedId)
    if (rangeId === "custom") {
      const from = readDashboardPreference(projectId, "range_from")
      const to = readDashboardPreference(projectId, "range_to")
      const custom = parseDashboardCustomRange(from, to)
      if (!custom) return
      persist("custom", custom)
      replaceSearch(
        (params) => {
          params.set("range_id", "custom")
          params.set("from", custom.from)
          params.set("to", custom.to)
        },
        { refresh: false }
      )
      return
    }
    persist(rangeId)
    replaceSearch(
      (params) => {
        params.set("range_id", rangeId)
        params.delete("from")
        params.delete("to")
      },
      { refresh: false }
    )
  }, [
    customRange,
    dateRangeId,
    persist,
    projectId,
    replaceSearch,
    searchParams,
  ])

  return {
    dateRangeId,
    customRange,
    setDateRangeId,
    setCustomRange,
    isPending,
  }
}
