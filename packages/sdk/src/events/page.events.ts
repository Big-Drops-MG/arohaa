import { track } from "../core/tracker"

export function trackPageView(): void {
  const pageTitle =
    typeof document !== "undefined"
      ? String(document.title ?? "")
          .trim()
          .slice(0, 300)
      : ""
  track("page_view", pageTitle ? { page_title: pageTitle } : {})
}

export function trackPageLeave(): void {
  const pageTitle =
    typeof document !== "undefined"
      ? String(document.title ?? "")
          .trim()
          .slice(0, 300)
      : ""
  track("page_leave", pageTitle ? { page_title: pageTitle } : {})
}

let spaPageViewsInstalled = false
let pageLeaveInstalled = false
let lastTrackedHref: string | null = null

export function setupSpaPageViews(): void {
  if (spaPageViewsInstalled || typeof window === "undefined") return
  if (typeof history === "undefined") return
  spaPageViewsInstalled = true
  lastTrackedHref = window.location.href

  const maybeTrack = (): void => {
    const next = window.location.href
    if (next === lastTrackedHref) return
    lastTrackedHref = next
    trackPageView()
  }

  window.addEventListener("popstate", maybeTrack)
  window.addEventListener("hashchange", maybeTrack)

  const originalPushState = history.pushState.bind(history)
  const originalReplaceState = history.replaceState.bind(history)

  history.pushState = (...args: Parameters<History["pushState"]>) => {
    originalPushState(...args)
    maybeTrack()
  }

  history.replaceState = (...args: Parameters<History["replaceState"]>) => {
    originalReplaceState(...args)
    maybeTrack()
  }
}

export function setupPageLeaveTracking(): void {
  if (pageLeaveInstalled || typeof window === "undefined") return
  pageLeaveInstalled = true

  const leave = (): void => {
    trackPageLeave()
  }

  document.addEventListener(
    "visibilitychange",
    () => {
      if (document.visibilityState === "hidden") leave()
    },
    true,
  )
  window.addEventListener("pagehide", leave, true)
}
