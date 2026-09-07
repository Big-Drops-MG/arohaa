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

  useEffect(() => {
    const match = pathname.match(/^\/dashboard\/([^/]+)\/?$/)
    if (!match?.[1] || !searchParams.toString()) return
    if (["new-landing", "ops", "profile", "team"].includes(match[1])) return
    router.replace(pathname, { scroll: false })
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
