import { track } from "../core/tracker"

export function trackPageView(): void {
  track("page_view")
}

export function trackPageLeave(): void {
  track("page_leave")
}

let spaPageViewsInstalled = false
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
