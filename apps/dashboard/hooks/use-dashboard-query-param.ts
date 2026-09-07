"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import {
  readDashboardPreference,
  subscribeDashboardPreference,
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
  const [storedValue, setStoredValue] = useState<T | null>(null)

  const value = projectId
    ? (storedValue ?? urlValue)
    : (optimisticValue ?? urlValue)

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
      if (projectId) {
        setStoredValue(next)
        writeDashboardPreference(projectId, key, next)
        return
      }
      setOptimisticValue(next)
      writeUrl(next, refreshOnChange)
    },
    [key, projectId, refreshOnChange, value, writeUrl]
  )

  useEffect(() => {
    if (!projectId) return
    if (searchParams.has(key)) {
      writeDashboardPreference(projectId, key, urlValue)
      setStoredValue(urlValue)
    }
  }, [key, projectId, searchParams, urlValue])

  useEffect(() => {
    if (!projectId || hydratedRef.current) return
    hydratedRef.current = true

    if (searchParams.has(key)) return

    const saved = readDashboardPreference(projectId, key)
    if (!saved) return
    const parsed = parseRef.current(saved)
    setStoredValue(parsed)
  }, [projectId])

  useEffect(() => {
    if (!projectId) return
    return subscribeDashboardPreference(projectId, key, (raw) => {
      if (!raw) return
      setStoredValue(parseRef.current(raw))
    })
  }, [key, projectId])

  return [value, setValue, { isPending }]
}
