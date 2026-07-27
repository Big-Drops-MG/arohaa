"use client"

import { useCallback, useEffect, useMemo, useRef } from "react"
import {
  hasDashboardUtmFilter,
  normalizeDashboardUtmFilter,
  parseDashboardUtmFilterFromParams,
  serializeUtmValueList,
  toggleDimensionValueInFilter,
  type DashboardUtmFilter,
  type UtmFilterDimension,
} from "@/features/dashboard/model/utm-attribution-filter"
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

export function useDashboardUtmFilter() {
  const { pathname, searchParams, replaceSearch, isPending } =
    useDashboardNavigation()
  const projectId = useMemo(() => projectIdFromPath(pathname), [pathname])
  const hydratedRef = useRef(false)

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
    (next: DashboardUtmFilter | null, refresh = true) => {
      const normalized = normalizeDashboardUtmFilter(next)
      const source = serializeUtmValueList(normalized?.utm_source)
      const s1 = serializeUtmValueList(normalized?.utm_s1)

      if (projectId) {
        writeDashboardPreference(projectId, "utm_source", source ?? "")
        writeDashboardPreference(projectId, "utm_s1", s1 ?? "")
      }

      replaceSearch(
        (params) => {
          params.delete("utm_dim")
          params.delete("utm_value")
          params.delete("utm_medium")
          if (source) params.set("utm_source", source)
          else params.delete("utm_source")
          if (s1) params.set("utm_s1", s1)
          else params.delete("utm_s1")
        },
        { refresh }
      )
    },
    [projectId, replaceSearch]
  )

  const setUtmFilter = useCallback(
    (next: DashboardUtmFilter | null) => {
      writeFilter(next, true)
    },
    [writeFilter]
  )

  const clearUtmFilter = useCallback(() => {
    writeFilter(null, true)
  }, [writeFilter])

  const toggleDimensionValue = useCallback(
    (dimension: UtmFilterDimension, value: string) => {
      writeFilter(
        toggleDimensionValueInFilter(utmFilter, dimension, value) ?? null,
        true
      )
    },
    [utmFilter, writeFilter]
  )

  useEffect(() => {
    if (!projectId || hydratedRef.current) return

    const hasUrlFilter =
      searchParams.has("utm_source") ||
      searchParams.has("utm_s1") ||
      searchParams.has("utm_dim")

    if (hasUrlFilter) {
      const source = serializeUtmValueList(utmFilter?.utm_source)
      const s1 = serializeUtmValueList(utmFilter?.utm_s1)
      writeDashboardPreference(projectId, "utm_source", source ?? "")
      writeDashboardPreference(projectId, "utm_s1", s1 ?? "")
      hydratedRef.current = true
      return
    }

    hydratedRef.current = true
    const source = readDashboardPreference(projectId, "utm_source")
    const s1 = readDashboardPreference(projectId, "utm_s1")
    if (!source && !s1) return

    const restored = parseDashboardUtmFilterFromParams({
      utm_source: source,
      utm_s1: s1,
    })
    if (!hasDashboardUtmFilter(restored)) return
    writeFilter(restored ?? null, false)
  }, [projectId, searchParams, utmFilter, writeFilter])

  return {
    utmFilter,
    setUtmFilter,
    clearUtmFilter,
    toggleDimensionValue,
    isPending,
  }
}
