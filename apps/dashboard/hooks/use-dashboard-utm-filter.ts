"use client"

import { useCallback, useMemo } from "react"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import {
  normalizeDashboardUtmFilter,
  parseDashboardUtmFilterFromParams,
  serializeUtmValueList,
  toggleDimensionValueInFilter,
  type DashboardUtmFilter,
  type UtmFilterDimension,
} from "@/features/dashboard/model/utm-attribution-filter"

export function useDashboardUtmFilter() {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  const utmFilter = useMemo(
    () =>
      parseDashboardUtmFilterFromParams({
        utm_source: searchParams.get("utm_source"),
        utm_s1: searchParams.get("utm_s1"),
        utm_dim: searchParams.get("utm_dim"),
        utm_value: searchParams.get("utm_value"),
      }),
    [searchParams]
  )

  const writeFilter = useCallback(
    (next: DashboardUtmFilter | null) => {
      const params = new URLSearchParams(searchParams.toString())
      params.delete("utm_dim")
      params.delete("utm_value")
      params.delete("utm_medium")

      const normalized = normalizeDashboardUtmFilter(next)
      const source = serializeUtmValueList(normalized?.utm_source)
      const s1 = serializeUtmValueList(normalized?.utm_s1)

      if (source) params.set("utm_source", source)
      else params.delete("utm_source")
      if (s1) params.set("utm_s1", s1)
      else params.delete("utm_s1")

      const query = params.toString()
      router.replace(query ? `${pathname}?${query}` : pathname, {
        scroll: false,
      })
    },
    [pathname, router, searchParams]
  )

  const setUtmFilter = useCallback(
    (next: DashboardUtmFilter | null) => {
      writeFilter(next)
    },
    [writeFilter]
  )

  const clearUtmFilter = useCallback(() => {
    writeFilter(null)
  }, [writeFilter])

  const toggleDimensionValue = useCallback(
    (dimension: UtmFilterDimension, value: string) => {
      writeFilter(
        toggleDimensionValueInFilter(utmFilter, dimension, value) ?? null
      )
    },
    [utmFilter, writeFilter]
  )

  return {
    utmFilter,
    setUtmFilter,
    clearUtmFilter,
    toggleDimensionValue,
  }
}
