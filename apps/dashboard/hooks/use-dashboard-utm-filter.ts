"use client"

import { useCallback, useMemo } from "react"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import {
  hasDashboardUtmFilter,
  normalizeDashboardUtmFilter,
  parseDashboardUtmFilterFromParams,
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
        utm_medium: searchParams.get("utm_medium"),
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

      const normalized = normalizeDashboardUtmFilter(next)
      if (!normalized) {
        params.delete("utm_source")
        params.delete("utm_medium")
      } else {
        if (normalized.utm_source)
          params.set("utm_source", normalized.utm_source)
        else params.delete("utm_source")
        if (normalized.utm_medium)
          params.set("utm_medium", normalized.utm_medium)
        else params.delete("utm_medium")
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
      writeFilter(next)
    },
    [writeFilter]
  )

  const clearUtmFilter = useCallback(() => {
    writeFilter(null)
  }, [writeFilter])

  const setDimensionValue = useCallback(
    (dimension: UtmFilterDimension, value: string | null) => {
      const current = normalizeDashboardUtmFilter(utmFilter) ?? {}
      const next: DashboardUtmFilter = { ...current }
      if (!value) {
        delete next[dimension]
      } else {
        next[dimension] = value
      }
      writeFilter(hasDashboardUtmFilter(next) ? next : null)
    },
    [utmFilter, writeFilter]
  )

  const toggleDimensionValue = useCallback(
    (dimension: UtmFilterDimension, value: string) => {
      const current = normalizeDashboardUtmFilter(utmFilter) ?? {}
      const selected = current[dimension]
      setDimensionValue(dimension, selected === value ? null : value)
    },
    [setDimensionValue, utmFilter]
  )

  return {
    utmFilter,
    setUtmFilter,
    clearUtmFilter,
    setDimensionValue,
    toggleDimensionValue,
  }
}
