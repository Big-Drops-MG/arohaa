import { track, trackMetric } from "../core/tracker"
import { getScrollPercent } from "../utils/helpers"

const MILESTONES = [25, 50, 75, 100] as const

const firedThresholds = new Set<number>()
let maxDepth = 0
let depthReported = false
let scrollSetup = false

function evaluateScroll(): void {
  const percent = getScrollPercent()
  if (percent > maxDepth) maxDepth = percent

  for (const t of MILESTONES) {
    if (percent >= t && !firedThresholds.has(t)) {
      firedThresholds.add(t)
      track(`scroll_${t}`)
    }
  }
}

function reportMaxDepth(): void {
  if (depthReported || maxDepth <= 0) return
  depthReported = true
  const value = Math.round(maxDepth * 100) / 100
  trackMetric("scroll_depth", "scroll_depth", value, {
    max_percent: value,
  })
}

export function setupScrollTracking(): void {
  if (scrollSetup) return
  scrollSetup = true

  evaluateScroll()

  window.addEventListener("scroll", evaluateScroll, { passive: true })

  if (typeof ResizeObserver !== "undefined") {
    const ro = new ResizeObserver(() => {
      evaluateScroll()
    })
    ro.observe(document.documentElement)
    if (document.body) ro.observe(document.body)
  }

  window.addEventListener("pagehide", reportMaxDepth)
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") reportMaxDepth()
  })
}
