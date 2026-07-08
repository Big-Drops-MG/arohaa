"use client"

import { useCallback, useMemo } from "react"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import {
  isUtmFilterDimension,
  parseDashboardUtmFilter,
  type DashboardUtmFilter,
  type UtmFilterDimension,
} from "@/features/dashboard/model/utm-attribution-filter"

export function useDashboardUtmFilter() {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  const utmFilter = useMemo(
    () =>
      parseDashboardUtmFilter(
        searchParams.get("utm_dim"),
        searchParams.get("utm_value")
      ),
    [searchParams]
  )

  const utmDimension = useMemo(
    () => searchParams.get("utm_dim"),
    [searchParams]
  )

  const setUtmDimension = useCallback(
    (dimension: UtmFilterDimension | "all") => {
      const params = new URLSearchParams(searchParams.toString())
      if (dimension === "all") {
        params.delete("utm_dim")
        params.delete("utm_value")
      } else {
        params.set("utm_dim", dimension)
        params.delete("utm_value")
      }
      const query = params.toString()
      router.replace(query ? `${pathname}?${query}` : pathname, {
        scroll: false,
      })
    },
    [pathname, router, searchParams]
  )

  const setUtmFilter = useCallback(
    (next: DashboardUtmFilter | null) => {
      const params = new URLSearchParams(searchParams.toString())
      if (!next) {
        params.delete("utm_dim")
        params.delete("utm_value")
      } else {
        params.set("utm_dim", next.dimension)
        params.set("utm_value", next.value)
      }
      const query = params.toString()
      router.replace(query ? `${pathname}?${query}` : pathname, {
        scroll: false,
      })
    },
    [pathname, router, searchParams]
  )

  const activeDimension = isUtmFilterDimension(utmDimension)
    ? utmDimension
    : ("all" as const)

  return {
    utmFilter,
    activeDimension,
    setUtmDimension,
    setUtmFilter,
  }
}
