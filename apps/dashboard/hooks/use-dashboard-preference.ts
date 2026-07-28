"use client"

import { useCallback, useState } from "react"
import {
  readDashboardPreference,
  writeDashboardPreference,
} from "@/lib/dashboard/dashboard-preferences"

/**
 * Project-scoped UI chrome preference (KPI tiles, nested card tabs, etc.).
 * Survives reload via localStorage without cluttering the shareable URL.
 * Shareable filters (tab, range, mode, …) soft-refresh via URL navigation instead.
 */
export function useDashboardPreference<T extends string>(
  projectId: string,
  key: string,
  parse: (raw: string | null) => T
): [T, (next: T | ((prev: T) => T)) => void] {
  const [value, setValueState] = useState<T>(() => {
    if (typeof window === "undefined") return parse(null)
    return parse(readDashboardPreference(projectId, key))
  })

  const setValue = useCallback(
    (next: T | ((prev: T) => T)) => {
      setValueState((prev) => {
        const resolved =
          typeof next === "function" ? (next as (p: T) => T)(prev) : next
        if (resolved === prev) return prev
        writeDashboardPreference(projectId, key, resolved)
        return resolved
      })
    },
    [key, projectId]
  )

  return [value, setValue]
}
