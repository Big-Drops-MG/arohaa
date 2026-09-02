"use client"

import { useEffect, useRef } from "react"
import { usePathname, useSearchParams } from "next/navigation"
import { PROJECT_TABS } from "@/features/dashboard/model/project-tab"

type ActivityEventPayload = {
  eventType: "page_view" | "tab_view" | "button_click" | "nav_click" | "action"
  summary: string
  path?: string
  tab?: string
  projectPublicId?: string
  targetLabel?: string
  targetHref?: string
  metadata?: Record<string, unknown>
}

const TAB_LABELS = Object.fromEntries(
  PROJECT_TABS.map((tab) => [tab.value, tab.label])
) as Record<string, string>

const FLUSH_MS = 2500
const MAX_QUEUE = 40

function projectIdFromPath(pathname: string): string | null {
  const match = pathname.match(/^\/dashboard\/([^/]+)/)
  if (!match?.[1]) return null
  const segment = match[1]
  if (
    segment === "team" ||
    segment === "ops" ||
    segment === "new-landing" ||
    segment === "profile"
  ) {
    return null
  }
  return segment
}

function currentProjectState(): {
  projectPublicId: string | null
  tab: string | null
} {
  if (typeof document === "undefined") {
    return { projectPublicId: null, tab: null }
  }
  const root = document.querySelector<HTMLElement>("[data-project-public-id]")
  return {
    projectPublicId: root?.dataset.projectPublicId ?? null,
    tab: root?.dataset.dashboardTab ?? null,
  }
}

function pageSummary(pathname: string, tab: string | null): string {
  if (pathname === "/dashboard" || pathname === "/dashboard/") {
    return "Viewed Landing Pages home"
  }
  if (pathname.startsWith("/dashboard/team")) {
    const section = new URLSearchParams(
      typeof window !== "undefined" ? window.location.search : ""
    ).get("section")
    if (section === "external") return "Viewed External Team"
    if (section === "pending") return "Viewed Pending access requests"
    return "Viewed Internal Team"
  }
  if (pathname.startsWith("/dashboard/ops")) return "Viewed Ops"
  if (pathname.startsWith("/dashboard/new-landing")) {
    return "Opened Add Landing Page"
  }
  if (pathname.startsWith("/dashboard/profile")) return "Viewed Profile"

  const projectId = projectIdFromPath(pathname)
  if (projectId) {
    const tabLabel = tab ? (TAB_LABELS[tab] ?? tab) : "Overview"
    return `Opened ${tabLabel} tab`
  }

  return `Viewed ${pathname}`
}

function readableLabel(el: HTMLElement): string {
  const aria = el.getAttribute("aria-label")?.trim()
  if (aria) return aria
  const titled = el.getAttribute("title")?.trim()
  if (titled) return titled
  const text = (el.innerText || el.textContent || "")
    .replace(/\s+/g, " ")
    .trim()
  if (text) return text.slice(0, 120)
  const name = el.getAttribute("name")?.trim()
  if (name) return name
  return el.tagName.toLowerCase()
}

function closestInteractive(target: EventTarget | null): HTMLElement | null {
  if (!(target instanceof Element)) return null
  return target.closest(
    "button, a, [role='button'], input[type='submit'], input[type='button']"
  ) as HTMLElement | null
}

function isNavElement(el: HTMLElement): boolean {
  return Boolean(
    el.closest("nav, [data-dashboard-nav], [data-sidebar], header")
  )
}

export function DashboardActivityTracker() {
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const queueRef = useRef<ActivityEventPayload[]>([])
  const flushTimerRef = useRef<number | null>(null)
  const lastPageKeyRef = useRef<string>("")
  const lastClickKeyRef = useRef<string>("")

  function flush() {
    const batch = queueRef.current.splice(0, MAX_QUEUE)
    if (flushTimerRef.current != null) {
      window.clearTimeout(flushTimerRef.current)
      flushTimerRef.current = null
    }
    if (batch.length === 0) return

    void fetch("/api/activity", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ events: batch }),
      credentials: "same-origin",
      keepalive: true,
      cache: "no-store",
    }).catch(() => {
      // activity logging should never break the UI
    })
  }

  function enqueue(event: ActivityEventPayload) {
    queueRef.current.push(event)
    if (queueRef.current.length >= MAX_QUEUE) {
      flush()
      return
    }
    if (flushTimerRef.current == null) {
      flushTimerRef.current = window.setTimeout(() => {
        flushTimerRef.current = null
        flush()
      }, FLUSH_MS)
    }
  }

  useEffect(() => {
    const state = currentProjectState()
    const tab = state.tab ?? searchParams.get("tab")
    const projectPublicId = state.projectPublicId ?? projectIdFromPath(pathname)
    const pageKey = `${pathname}?${searchParams.toString()}`
    if (pageKey === lastPageKeyRef.current) return
    lastPageKeyRef.current = pageKey

    const isProjectTab = Boolean(projectPublicId)
    enqueue({
      eventType: isProjectTab ? "tab_view" : "page_view",
      summary: pageSummary(pathname, tab),
      path: `${pathname}${searchParams.toString() ? `?${searchParams.toString()}` : ""}`,
      tab: tab || (isProjectTab ? "overview" : undefined),
      projectPublicId: projectPublicId || undefined,
      metadata: {
        section: searchParams.get("section") || undefined,
      },
    })
  }, [pathname, searchParams])

  useEffect(() => {
    function onClick(event: MouseEvent) {
      const el = closestInteractive(event.target)
      if (!el) return
      if (el.getAttribute("data-activity-ignore") === "true") return

      const label = readableLabel(el)
      if (!label || label.length < 1) return

      const href =
        el instanceof HTMLAnchorElement
          ? el.getAttribute("href")
          : el.getAttribute("data-href")
      const clickKey = `${label}::${href ?? ""}::${Date.now() - (Date.now() % 400)}`
      if (clickKey === lastClickKeyRef.current) return
      lastClickKeyRef.current = clickKey

      const state = currentProjectState()
      const projectPublicId =
        state.projectPublicId ?? projectIdFromPath(window.location.pathname)
      const tab =
        state.tab ?? new URLSearchParams(window.location.search).get("tab")
      const nav = isNavElement(el)

      enqueue({
        eventType: nav ? "nav_click" : "button_click",
        summary: nav ? `Navigated via “${label}”` : `Clicked “${label}”`,
        path: `${window.location.pathname}${window.location.search}`,
        tab: tab || (projectPublicId ? "overview" : undefined),
        projectPublicId: projectPublicId || undefined,
        targetLabel: label,
        targetHref: href || undefined,
        metadata: {
          tag: el.tagName.toLowerCase(),
          role: el.getAttribute("role") || undefined,
        },
      })
    }

    function onVisibility() {
      if (document.visibilityState === "hidden") flush()
    }

    function onDashboardTab(event: Event) {
      const detail = (
        event as CustomEvent<{ projectPublicId?: string; tab?: string }>
      ).detail
      if (!detail?.projectPublicId || !detail.tab) return
      const pageKey = `${pathname}::${detail.tab}`
      if (pageKey === lastPageKeyRef.current) return
      lastPageKeyRef.current = pageKey
      enqueue({
        eventType: "tab_view",
        summary: pageSummary(pathname, detail.tab),
        path: pathname,
        tab: detail.tab,
        projectPublicId: detail.projectPublicId,
      })
    }

    document.addEventListener("click", onClick, true)
    window.addEventListener("arohaa:dashboard-tab", onDashboardTab)
    window.addEventListener("pagehide", flush)
    document.addEventListener("visibilitychange", onVisibility)

    return () => {
      document.removeEventListener("click", onClick, true)
      window.removeEventListener("arohaa:dashboard-tab", onDashboardTab)
      window.removeEventListener("pagehide", flush)
      document.removeEventListener("visibilitychange", onVisibility)
      flush()
    }
  }, [])

  return null
}
