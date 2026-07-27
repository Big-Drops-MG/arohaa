"use client"

import { useCallback, useEffect, useMemo, useRef } from "react"
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
}

/**
 * Sync a dashboard selection to the URL (shareable + reload-safe) and optionally
 * mirror it in localStorage so a bare project URL restores the last choice.
 * User changes soft-refresh the page via App Router (no hard reload).
 */
export function useDashboardQueryParam<T extends string>(
  key: string,
  { parse, projectId, omitDefault = false }: UseDashboardQueryParamOptions<T>
): [T, (next: T) => void, { isPending: boolean }] {
  const { searchParams, replaceSearch, isPending } = useDashboardNavigation()
  const hydratedRef = useRef(false)
  const parseRef = useRef(parse)
  parseRef.current = parse

  const value = useMemo(
    () => parseRef.current(searchParams.get(key)),
    [key, searchParams]
  )

  const defaultValue = useMemo(() => parseRef.current(null), [])

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
      if (projectId) writeDashboardPreference(projectId, key, next)
      writeUrl(next, true)
    },
    [key, projectId, value, writeUrl]
  )

  useEffect(() => {
    if (!projectId) return
    if (searchParams.has(key)) {
      writeDashboardPreference(projectId, key, value)
    }
  }, [key, projectId, searchParams, value])

  useEffect(() => {
    if (!projectId || hydratedRef.current) return
    hydratedRef.current = true

    if (searchParams.has(key)) return

    const saved = readDashboardPreference(projectId, key)
    if (!saved) return
    const parsed = parseRef.current(saved)
    writeUrl(parsed, false)
    // Restore once per mount when the URL is missing this key.
    // eslint-disable-next-line react-hooks/exhaustive-deps -- intentional one-shot hydrate
  }, [projectId])

  return [value, setValue, { isPending }]
}
