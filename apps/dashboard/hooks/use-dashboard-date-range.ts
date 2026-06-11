"use client"

import { useCallback, useMemo } from "react"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import type { OverviewDateRangeId } from "@/features/overview/model/overview"
import { parseTrafficRangeId } from "@/features/traffic/model/traffic-range"

export function useDashboardDateRange() {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  const dateRangeId = useMemo(
    () => parseTrafficRangeId(searchParams.get("range_id")),
    [searchParams]
  )

  const setDateRangeId = useCallback(
    (nextRangeId: OverviewDateRangeId) => {
      if (nextRangeId === dateRangeId) return

      const params = new URLSearchParams(searchParams.toString())
      params.set("range_id", nextRangeId)
      const query = params.toString()
      router.replace(query ? `${pathname}?${query}` : pathname, {
        scroll: false,
      })
    },
    [dateRangeId, pathname, router, searchParams]
  )

  return { dateRangeId, setDateRangeId }
}
