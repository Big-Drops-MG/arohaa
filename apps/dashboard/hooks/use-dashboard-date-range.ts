"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import type { OverviewDateRangeId } from "@/features/overview/model/overview"
import {
  parseDashboardCustomRange,
  parseTrafficRangeId,
  type DashboardCustomRange,
} from "@/features/traffic/model/traffic-range"
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

export function useDashboardDateRange() {
  const { pathname, searchParams, isPending } = useDashboardNavigation()
  const projectId = useMemo(() => projectIdFromPath(pathname), [pathname])
  const hydratedRef = useRef(false)

  const legacyDateRangeId = useMemo(
    () => parseTrafficRangeId(searchParams.get("range_id")),
    [searchParams]
  )
  const legacyCustomRange = useMemo(() => {
    if (legacyDateRangeId !== "custom") return undefined
    return parseDashboardCustomRange(
      searchParams.get("from"),
      searchParams.get("to")
    )
  }, [legacyDateRangeId, searchParams])
  const [dateRangeId, setDateRangeState] =
    useState<OverviewDateRangeId>(legacyDateRangeId)
  const [customRange, setCustomRangeState] = useState<
    DashboardCustomRange | undefined
  >(legacyCustomRange)

  const persist = useCallback(
    (rangeId: OverviewDateRangeId, custom?: DashboardCustomRange) => {
      if (!projectId) return
      if (rangeId === "custom" && custom) {
        writeDashboardPreference(projectId, "range_from", custom.from)
        writeDashboardPreference(projectId, "range_to", custom.to)
      }
      writeDashboardPreference(projectId, "range_id", rangeId)
    },
    [projectId]
  )

  const setDateRangeId = useCallback(
    (nextRangeId: OverviewDateRangeId) => {
      if (nextRangeId === "custom") return
      if (nextRangeId === dateRangeId) return

      persist(nextRangeId)
      setDateRangeState(nextRangeId)
      setCustomRangeState(undefined)
    },
    [dateRangeId, persist]
  )

  const setCustomRange = useCallback(
    (next: DashboardCustomRange) => {
      persist("custom", next)
      setDateRangeState("custom")
      setCustomRangeState(next)
    },
    [persist]
  )

  useEffect(() => {
    if (!projectId || hydratedRef.current) return

    if (searchParams.has("range_id")) {
      persist(legacyDateRangeId, legacyCustomRange)
      setDateRangeState(legacyDateRangeId)
      setCustomRangeState(legacyCustomRange)
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
      setDateRangeState("custom")
      setCustomRangeState(custom)
      return
    }
    persist(rangeId)
    setDateRangeState(rangeId)
    setCustomRangeState(undefined)
  }, [legacyCustomRange, legacyDateRangeId, persist, projectId, searchParams])

  useEffect(() => {
    if (!projectId) return
    return subscribeDashboardPreference(projectId, "range_id", (raw) => {
      const nextRangeId = parseTrafficRangeId(raw)
      if (nextRangeId === "custom") {
        const nextCustomRange = parseDashboardCustomRange(
          readDashboardPreference(projectId, "range_from"),
          readDashboardPreference(projectId, "range_to")
        )
        if (!nextCustomRange) return
        setDateRangeState("custom")
        setCustomRangeState(nextCustomRange)
        return
      }
      setDateRangeState(nextRangeId)
      setCustomRangeState(undefined)
    })
  }, [projectId])

  return {
    dateRangeId,
    customRange,
    setDateRangeId,
    setCustomRange,
    isPending,
  }
}
