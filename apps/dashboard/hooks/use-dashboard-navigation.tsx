"use client"

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useTransition,
  type ReactNode,
} from "react"
import { usePathname, useRouter, useSearchParams } from "next/navigation"

type ReplaceSearchOptions = {
  /**
   * Revalidate RSC/server data after the URL change (default true for user
   * actions). Set false for silent preference hydration on first paint.
   */
  refresh?: boolean
}

type DashboardNavigationValue = {
  pathname: string
  searchParams: URLSearchParams
  isPending: boolean
  replaceSearch: (
    mutate: (params: URLSearchParams) => void,
    options?: ReplaceSearchOptions
  ) => void
  /** Soft-refresh RSC tree without changing the URL (localStorage-only prefs). */
  softRefresh: () => void
}

const DashboardNavigationContext =
  createContext<DashboardNavigationValue | null>(null)

const LEGACY_PROJECT_FILTER_QUERY_KEYS = [
  "range_id",
  "from",
  "to",
  "utm_source",
  "utm_s1",
  "utm_dim",
  "utm_value",
  "segment_id",
] as const

/**
 * Modern App Router navigation for dashboard filters:
 * URL replace + soft refresh inside a transition (no hard window.reload).
 * One provider so pending UI is shared across tabs, date range, and UTM.
 */
export function DashboardNavigationProvider({
  children,
}: {
  children: ReactNode
}) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [isPending, startTransition] = useTransition()

  // Filters live in localStorage now. Strip only legacy filter query keys from
  // project URLs so shared links stay clean — never wipe intentional UI state
  // like ?tab=, ?lab=, heatmap mode/device, etc.
  useEffect(() => {
    const match = pathname.match(/^\/dashboard\/([^/]+)\/?$/)
    if (!match?.[1]) return
    if (["new-landing", "ops", "profile", "team"].includes(match[1])) return

    const hasLegacy = LEGACY_PROJECT_FILTER_QUERY_KEYS.some((key) =>
      searchParams.has(key)
    )
    if (!hasLegacy) return

    const next = new URLSearchParams(searchParams.toString())
    for (const key of LEGACY_PROJECT_FILTER_QUERY_KEYS) {
      next.delete(key)
    }
    const query = next.toString()
    const href = query ? `${pathname}?${query}` : pathname
    router.replace(href, { scroll: false })
  }, [pathname, router, searchParams])

  const replaceSearch = useCallback(
    (
      mutate: (params: URLSearchParams) => void,
      options: ReplaceSearchOptions = {}
    ) => {
      const { refresh = true } = options
      const params = new URLSearchParams(searchParams.toString())
      mutate(params)
      const query = params.toString()
      const href = query ? `${pathname}?${query}` : pathname

      startTransition(() => {
        router.replace(href, { scroll: false })
      })

      if (refresh) {
        // Defer so replace commits before RSC revalidation reads the URL.
        queueMicrotask(() => {
          startTransition(() => {
            router.refresh()
          })
        })
      }
    },
    [pathname, router, searchParams]
  )

  const softRefresh = useCallback(() => {
    startTransition(() => {
      router.refresh()
    })
  }, [router])

  const value = useMemo(
    () => ({
      pathname,
      searchParams,
      isPending,
      replaceSearch,
      softRefresh,
    }),
    [isPending, pathname, replaceSearch, searchParams, softRefresh]
  )

  return (
    <DashboardNavigationContext.Provider value={value}>
      {children}
    </DashboardNavigationContext.Provider>
  )
}

export function useDashboardNavigation(): DashboardNavigationValue {
  const ctx = useContext(DashboardNavigationContext)
  if (!ctx) {
    throw new Error(
      "useDashboardNavigation must be used within DashboardNavigationProvider"
    )
  }
  return ctx
}
