"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import {
  readDashboardPreference,
  writeDashboardPreference,
} from "@/lib/dashboard/dashboard-preferences"
import { useDashboardNavigation } from "@/hooks/use-dashboard-navigation"

type UseDashboardQueryParamOptions<T extends string> = {
  parse: (raw: string | null) => T
  /** Persist/restore when the URL omits this key (survives clean reloads). */
  projectId?: string
  /** Delete the query key when the value equals parse(null). */
  omitDefault?: boolean
  /**
   * Soft-refresh RSC after URL change. Disable for client-fetched chrome
   * (e.g. project tabs) to avoid a replace/refresh race that keeps the old tab.
   */
  refreshOnChange?: boolean
}

/**
 * Sync a dashboard selection to the URL (shareable + reload-safe) and optionally
 * mirror it in localStorage so a bare project URL restores the last choice.
 * Updates apply optimistically so controlled UI (tabs, selects) switches on the
 * first click while the App Router URL catches up.
 */
export function useDashboardQueryParam<T extends string>(
  key: string,
  {
    parse,
    projectId,
    omitDefault = false,
    refreshOnChange = true,
  }: UseDashboardQueryParamOptions<T>
): [T, (next: T) => void, { isPending: boolean }] {
  const { searchParams, replaceSearch, isPending } = useDashboardNavigation()
  const hydratedRef = useRef(false)
  const parseRef = useRef(parse)
  parseRef.current = parse

  const urlValue = useMemo(
    () => parseRef.current(searchParams.get(key)),
    [key, searchParams]
  )

  const [optimisticValue, setOptimisticValue] = useState<T | null>(null)

  const value = optimisticValue ?? urlValue

  const defaultValue = useMemo(() => parseRef.current(null), [])

  useEffect(() => {
    if (optimisticValue === null) return
    if (urlValue === optimisticValue) {
      setOptimisticValue(null)
    }
  }, [optimisticValue, urlValue])

  const writeUrl = useCallback(
    (next: T, refresh: boolean) => {
      replaceSearch(
        (params) => {
          if (omitDefault && next === defaultValue) {
            params.delete(key)
          } else {
            params.set(key, next)
          }
        },
        { refresh }
      )
    },
    [defaultValue, key, omitDefault, replaceSearch]
  )

  const setValue = useCallback(
    (next: T) => {
      if (next === value) return
      setOptimisticValue(next)
      if (projectId) writeDashboardPreference(projectId, key, next)
      writeUrl(next, refreshOnChange)
    },
    [key, projectId, refreshOnChange, value, writeUrl]
  )

  useEffect(() => {
    if (!projectId) return
    if (searchParams.has(key)) {
      writeDashboardPreference(projectId, key, urlValue)
    }
  }, [key, projectId, searchParams, urlValue])

  useEffect(() => {
    if (!projectId || hydratedRef.current) return
    hydratedRef.current = true

    if (searchParams.has(key)) return

    const saved = readDashboardPreference(projectId, key)
    if (!saved) return
    const parsed = parseRef.current(saved)
    setOptimisticValue(parsed)
    writeUrl(parsed, false)
    // Restore once per mount when the URL is missing this key.
    // eslint-disable-next-line react-hooks/exhaustive-deps -- intentional one-shot hydrate
  }, [projectId])

  return [value, setValue, { isPending }]
}
