"use client"

import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { Button } from "@workspace/ui/components/button"
import { Input } from "@workspace/ui/components/input"
import { Plus, Search } from "lucide-react"
import type {
  LandingPageListItem,
  LandingPageMetric,
} from "@/features/dashboard/model/landing-page"
import {
  groupLandingPagesByBrand,
  resolvePageBrand,
} from "@/features/dashboard/model/landing-page-brands"
import { NEW_LANDING_PATH } from "@/features/dashboard/model/new-landing-mode"
import { AddNewProjectMenu } from "@/features/dashboard/view/AddNewProjectMenu"
import { LandingPageCard } from "@/features/dashboard/view/LandingPageCard"
import { LandingPagesBrandSidebar } from "@/features/dashboard/view/LandingPagesBrandSidebar"
import { dashboardPageInsetClassName } from "@/features/overview/view/overview-card-density"
import { cn } from "@workspace/ui/lib/utils"

const METRICS_REFRESH_MS = 30_000

type LandingPagesDashboardProps = {
  pages: LandingPageListItem[]
  canCreateProjects?: boolean
}

export function LandingPagesDashboard({
  pages,
  canCreateProjects = true,
}: LandingPagesDashboardProps) {
  const [query, setQuery] = useState("")
  const [selectedBrandKey, setSelectedBrandKey] = useState<string | null>(null)
  const [liveMetricsByPublicId, setLiveMetricsByPublicId] = useState<Record<
    string,
    LandingPageMetric[]
  > | null>(null)

  useEffect(() => {
    let cancelled = false

    async function refreshMetrics() {
      if (document.visibilityState !== "visible") return
      try {
        const res = await fetch("/api/landing-pages/card-metrics", {
          cache: "no-store",
        })
        if (!res.ok) return
        const payload = (await res.json().catch(() => null)) as {
          metricsByPublicId?: Record<string, LandingPageMetric[]>
        } | null
        if (cancelled || !payload?.metricsByPublicId) return
        setLiveMetricsByPublicId(payload.metricsByPublicId)
      } catch {
        // Keep last good metrics on transient failures.
      }
    }

    void refreshMetrics()
    const intervalId = window.setInterval(refreshMetrics, METRICS_REFRESH_MS)
    const onVisibility = () => {
      if (document.visibilityState === "visible") void refreshMetrics()
    }
    document.addEventListener("visibilitychange", onVisibility)

    return () => {
      cancelled = true
      window.clearInterval(intervalId)
      document.removeEventListener("visibilitychange", onVisibility)
    }
  }, [])

  const pagesWithMetrics = useMemo(
    () =>
      pages.map((page) => ({
        ...page,
        metrics: liveMetricsByPublicId?.[page.publicId] ?? page.metrics,
      })),
    [pages, liveMetricsByPublicId]
  )

  const filteredPages = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase()
    if (!normalizedQuery) return pagesWithMetrics
    return pagesWithMetrics.filter((page) => {
      const searchableText =
        `${resolvePageBrand(page).brandName} ${page.brandName} ${page.landingPageUrl} ${page.channelType ?? ""} ${page.experimentName ?? ""} ${page.experimentGroupName ?? ""} ${page.variantLabel ?? ""}`.toLowerCase()
      return searchableText.includes(normalizedQuery)
    })
  }, [pagesWithMetrics, query])

  const brands = useMemo(
    () => groupLandingPagesByBrand(filteredPages),
    [filteredPages]
  )

  useEffect(() => {
    if (brands.length === 0) {
      setSelectedBrandKey(null)
      return
    }
    const brandStillVisible = brands.some(
      (brand) => brand.brandKey === selectedBrandKey
    )
    if (!brandStillVisible) {
      setSelectedBrandKey(brands[0]!.brandKey)
    }
  }, [brands, selectedBrandKey])

  const selectedBrand =
    brands.find((brand) => brand.brandKey === selectedBrandKey) ?? null
  const rightPages = selectedBrand?.pages ?? []

  function selectBrand(brandKey: string) {
    setSelectedBrandKey(brandKey)
  }

  if (pages.length === 0) {
    return (
      <div
        className={cn(
          "mx-auto flex w-full max-w-[1440px] flex-1 flex-col items-center justify-center py-10",
          dashboardPageInsetClassName
        )}
      >
        {canCreateProjects ? (
          <Button type="button" size="lg" className="gap-2" asChild>
            <Link href={NEW_LANDING_PATH}>
              <Plus className="size-5" aria-hidden />
              Add a Landing Page
            </Link>
          </Button>
        ) : (
          <p className="max-w-md text-center text-sm text-muted-foreground">
            No landing pages yet. Your account is read-only, so you cannot
            create projects.
          </p>
        )}
      </div>
    )
  }

  return (
    <div
      className={cn(
        "mx-auto flex w-full max-w-[1440px] flex-1 flex-col py-9",
        dashboardPageInsetClassName
      )}
    >
      <div className="mb-6 grid gap-4 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center">
        <div className="flex min-w-0 flex-col gap-4 sm:flex-row sm:items-center">
          <h1 className="shrink-0 text-xl font-semibold text-foreground">
            Landing Pages
          </h1>
          <div className="relative min-w-0 flex-1">
            <div className="pointer-events-none absolute top-1/2 left-2 flex size-8 -translate-y-1/2 items-center justify-center rounded-sm bg-slate-950 text-white">
              <Search className="size-4" aria-hidden />
            </div>
            <Input
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search brands, projects, or variants"
              aria-label="Search brands, projects, or variants"
              className="h-11 rounded-md border-neutral-400 pl-12 text-sm shadow-none"
            />
          </div>
        </div>

        {canCreateProjects ? (
          <AddNewProjectMenu className="h-11 rounded-md px-5" />
        ) : null}
      </div>

      <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,8fr)] lg:gap-0">
        <div className="min-w-0 lg:border-r lg:border-border lg:pr-6">
          <LandingPagesBrandSidebar
            brands={brands}
            selectedBrandKey={selectedBrandKey}
            onSelectBrand={selectBrand}
          />
        </div>

        <section className="min-w-0 lg:pl-6">
          {selectedBrand ? (
            <div className="flex flex-col gap-4">
              <div className="flex flex-wrap items-end justify-between gap-2">
                <div className="min-w-0">
                  <h2 className="truncate text-lg font-semibold text-foreground">
                    {selectedBrand.brandName}
                  </h2>
                  <p className="text-sm text-muted-foreground">
                    {selectedBrand.pages.length}{" "}
                    {selectedBrand.pages.length === 1 ? "project" : "projects"}
                    {selectedBrand.pages.some((page) => page.variantLabel)
                      ? " including variants"
                      : ""}
                  </p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-6">
                {rightPages.map((page) => (
                  <LandingPageCard key={page.publicId} page={page} />
                ))}
              </div>
            </div>
          ) : (
            <div className="rounded-xl border border-border bg-card px-6 py-10 text-center text-sm text-muted-foreground">
              No landing pages match your search.
            </div>
          )}
        </section>
      </div>
    </div>
  )
}
