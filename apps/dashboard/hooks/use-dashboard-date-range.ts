"use client"

import { useCallback, useMemo } from "react"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import type { OverviewDateRangeId } from "@/features/overview/model/overview"
import {
  parseDashboardCustomRange,
  parseTrafficRangeId,
  type DashboardCustomRange,
} from "@/features/traffic/model/traffic-range"

export function useDashboardDateRange() {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

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

  const setDateRangeId = useCallback(
    (nextRangeId: OverviewDateRangeId) => {
      if (nextRangeId === "custom") return
      if (nextRangeId === dateRangeId) return

      const params = new URLSearchParams(searchParams.toString())
      params.set("range_id", nextRangeId)
      params.delete("from")
      params.delete("to")
      const query = params.toString()
      router.replace(query ? `${pathname}?${query}` : pathname, {
        scroll: false,
      })
    },
    [dateRangeId, pathname, router, searchParams]
  )

  const setCustomRange = useCallback(
    (next: DashboardCustomRange) => {
      const params = new URLSearchParams(searchParams.toString())
      params.set("range_id", "custom")
      params.set("from", next.from)
      params.set("to", next.to)
      const query = params.toString()
      router.replace(query ? `${pathname}?${query}` : pathname, {
        scroll: false,
      })
    },
    [pathname, router, searchParams]
  )

  return { dateRangeId, customRange, setDateRangeId, setCustomRange }
}
