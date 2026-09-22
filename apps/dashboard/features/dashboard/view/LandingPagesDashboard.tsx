"use client"

import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { Button } from "@workspace/ui/components/button"
import { Input } from "@workspace/ui/components/input"
import { ChevronDown, Plus, Search } from "lucide-react"
import { cn } from "@workspace/ui/lib/utils"
import type {
  LandingPageListItem,
  LandingPageMetric,
} from "@/features/dashboard/model/landing-page"
import { NEW_LANDING_PATH } from "@/features/dashboard/model/new-landing-mode"
import { AddNewProjectMenu } from "@/features/dashboard/view/AddNewProjectMenu"
import { LandingPageCard } from "@/features/dashboard/view/LandingPageCard"

const METRICS_REFRESH_MS = 30_000

type LandingPagesDashboardProps = {
  pages: LandingPageListItem[]
  canCreateProjects?: boolean
}

type ExperimentGroup = {
  experimentId: string
  title: string
  subtitle: string | null
  pages: LandingPageListItem[]
}

function sortPages(pages: LandingPageListItem[]): LandingPageListItem[] {
  return [...pages].sort((a, b) => {
    const aLabel = a.variantLabel?.toUpperCase() ?? ""
    const bLabel = b.variantLabel?.toUpperCase() ?? ""
    if (aLabel && bLabel && aLabel !== bLabel) {
      return aLabel.localeCompare(bLabel)
    }
    if (a.hubPublicId && a.publicId === a.hubPublicId) return -1
    if (b.hubPublicId && b.publicId === b.hubPublicId) return 1
    return a.brandName.localeCompare(b.brandName)
  })
}

function partitionPages(pages: LandingPageListItem[]): {
  groups: ExperimentGroup[]
  solos: LandingPageListItem[]
} {
  const byExperiment = new Map<string, LandingPageListItem[]>()
  const solos: LandingPageListItem[] = []

  for (const page of pages) {
    if (!page.experimentId) {
      solos.push(page)
      continue
    }
    const bucket = byExperiment.get(page.experimentId) ?? []
    bucket.push(page)
    byExperiment.set(page.experimentId, bucket)
  }

  const groups: ExperimentGroup[] = []
  for (const [experimentId, members] of byExperiment) {
    if (members.length < 2) {
      solos.push(...members)
      continue
    }
    const sorted = sortPages(members)
    const hub =
      sorted.find((page) => page.publicId === page.hubPublicId) ?? sorted[0]!
    const title = hub.experimentGroupName?.trim() || hub.brandName
    const subtitle =
      hub.experimentName && hub.experimentName !== title
        ? hub.experimentName
        : null
    groups.push({ experimentId, title, subtitle, pages: sorted })
  }

  groups.sort((a, b) => a.title.localeCompare(b.title))
  solos.sort((a, b) => a.brandName.localeCompare(b.brandName))

  return { groups, solos }
}

export function LandingPagesDashboard({
  pages,
  canCreateProjects = true,
}: LandingPagesDashboardProps) {
  const [query, setQuery] = useState("")
  const [collapsedIds, setCollapsedIds] = useState<Set<string>>(() => new Set())
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
        `${page.brandName} ${page.landingPageUrl} ${page.channelType ?? ""} ${page.experimentName ?? ""} ${page.experimentGroupName ?? ""} ${page.variantLabel ?? ""}`.toLowerCase()
      return searchableText.includes(normalizedQuery)
    })
  }, [pagesWithMetrics, query])

  const { groups, solos } = useMemo(
    () => partitionPages(filteredPages),
    [filteredPages]
  )

  const toggleGroup = (experimentId: string) => {
    setCollapsedIds((prev) => {
      const next = new Set(prev)
      if (next.has(experimentId)) next.delete(experimentId)
      else next.add(experimentId)
      return next
    })
  }

  if (pages.length === 0) {
    return (
      <div className="mx-auto flex w-full max-w-[1440px] flex-1 flex-col items-center justify-center py-10">
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

  const hasResults = groups.length > 0 || solos.length > 0

  return (
    <div className="mx-auto flex w-full max-w-[1440px] flex-1 flex-col py-9">
      <div className="mb-6 grid gap-4 lg:grid-cols-[180px_minmax(280px,1fr)_140px] lg:items-center">
        <h1 className="text-xl font-semibold text-foreground">Landing Pages</h1>

        <div className="relative">
          <div className="pointer-events-none absolute top-1/2 left-2 flex size-8 -translate-y-1/2 items-center justify-center rounded-sm bg-slate-950 text-white">
            <Search className="size-4" aria-hidden />
          </div>
          <Input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search landing pages"
            aria-label="Search landing pages"
            className="h-11 rounded-md border-neutral-400 pl-12 text-sm shadow-none"
          />
        </div>

        {canCreateProjects ? (
          <AddNewProjectMenu className="h-11 rounded-md px-5" />
        ) : (
          <div className="hidden lg:block" aria-hidden />
        )}
      </div>

      {hasResults ? (
        <div className="flex flex-col gap-8">
          {groups.map((group) => {
            const collapsed = collapsedIds.has(group.experimentId)
            const panelId = `experiment-group-${group.experimentId}`
            return (
              <section
                key={group.experimentId}
                className="rounded-2xl border border-indigo-200/70 bg-indigo-50/30"
              >
                <button
                  type="button"
                  className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-indigo-50/80"
                  aria-expanded={!collapsed}
                  aria-controls={panelId}
                  onClick={() => toggleGroup(group.experimentId)}
                >
                  <ChevronDown
                    className={cn(
                      "size-4 shrink-0 text-indigo-700 transition-transform",
                      collapsed && "-rotate-90"
                    )}
                    aria-hidden
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="truncate text-sm font-semibold text-foreground">
                        {group.title}
                      </h2>
                      <span className="inline-flex h-5 items-center rounded-full bg-indigo-100 px-2 text-[11px] font-medium text-indigo-800 ring-1 ring-indigo-200/80">
                        {group.pages.length} variants
                      </span>
                    </div>
                    {group.subtitle ? (
                      <p className="mt-0.5 truncate text-xs text-muted-foreground">
                        {group.subtitle}
                      </p>
                    ) : null}
                  </div>
                </button>

                {!collapsed ? (
                  <div
                    id={panelId}
                    className="border-t border-indigo-200/60 px-4 pt-4 pb-4"
                  >
                    <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                      {group.pages.map((page) => (
                        <LandingPageCard key={page.publicId} page={page} />
                      ))}
                    </div>
                  </div>
                ) : null}
              </section>
            )
          })}

          {solos.length > 0 ? (
            <div className="flex flex-col gap-4">
              {groups.length > 0 ? (
                <h2 className="text-sm font-semibold text-foreground">
                  Other projects
                </h2>
              ) : null}
              <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                {solos.map((page) => (
                  <LandingPageCard key={page.publicId} page={page} />
                ))}
              </div>
            </div>
          ) : null}
        </div>
      ) : (
        <div className="rounded-xl border border-border bg-card px-6 py-10 text-center text-sm text-muted-foreground">
          No landing pages match your search.
        </div>
      )}
    </div>
  )
}
