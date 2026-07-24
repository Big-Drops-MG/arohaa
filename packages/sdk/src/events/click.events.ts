import { track } from "../core/tracker"
import { getPageNorm } from "../utils/helpers"
import { getStableSelector } from "../utils/selector"

type DeviceType = "mobile" | "tablet" | "desktop"

type ClickSample = {
  selector: string
  x: number
  y: number
  ts: number
}

const RAGE_WINDOW_MS = 1000
const RAGE_RADIUS_PX = 30
const RAGE_COUNT = 3

const recentClicks: ClickSample[] = []

function resolveClickTarget(target: EventTarget | null): HTMLElement | null {
  if (!(target instanceof HTMLElement)) return null
  return target
}

function resolveDevice(): DeviceType {
  const w = window.innerWidth
  if (w < 768) return "mobile"
  if (w < 1024) return "tablet"
  return "desktop"
}

function clamp01(value: number): number {
  if (!Number.isFinite(value)) return 0
  if (value < 0) return 0
  if (value > 1) return 1
  return value
}

function elementNorm(e: MouseEvent, el: HTMLElement): { x: number; y: number } {
  const rect = el.getBoundingClientRect()
  const w = rect.width || 1
  const h = rect.height || 1
  return {
    x: clamp01((e.clientX - rect.left) / w),
    y: clamp01((e.clientY - rect.top) / h),
  }
}

function isRageClick(sample: ClickSample): boolean {
  const cutoff = sample.ts - RAGE_WINDOW_MS
  while (recentClicks.length > 0 && recentClicks[0]!.ts < cutoff) {
    recentClicks.shift()
  }

  let matches = 0
  for (const prev of recentClicks) {
    if (prev.selector !== sample.selector) continue
    const dx = prev.x - sample.x
    const dy = prev.y - sample.y
    if (dx * dx + dy * dy <= RAGE_RADIUS_PX * RAGE_RADIUS_PX) {
      matches += 1
    }
  }

  recentClicks.push(sample)
  if (recentClicks.length > 20) recentClicks.shift()

  return matches + 1 >= RAGE_COUNT
}

function trackHeatmapClick(e: MouseEvent, target: HTMLElement): void {
  const { x, y } = elementNorm(e, target)
  const vw = window.innerWidth || 1
  const vh = window.innerHeight || 1
  const { px, py } = getPageNorm(e.clientX, e.clientY)
  const selector = getStableSelector(target)
  const sample: ClickSample = {
    selector,
    x: e.clientX,
    y: e.clientY,
    ts: Date.now(),
  }
  const rage = isRageClick(sample)

  track("heatmap_click", {
    x,
    y,
    vx: clamp01(e.clientX / vw),
    vy: clamp01(e.clientY / vh),
    px,
    py,
    selector,
    vw: window.innerWidth,
    vh: window.innerHeight,
    device: resolveDevice(),
    rage,
  })
}

export function setupClickTracking(): void {
  document.addEventListener(
    "click",
    (e) => {
      const target = resolveClickTarget(e.target)
      if (!target) return

      trackHeatmapClick(e, target)

      const anchor = target.closest("a")
      if (anchor) {
        const href = anchor.href
        if (href.startsWith("tel:")) {
          track("call_click", {
            href,
            text: anchor.innerText?.trim() || undefined,
          })
          return
        }

        track("link_click", {
          href,
          text: anchor.innerText?.trim() || undefined,
        })
        return
      }

      const button = target.closest("button")
      if (button) {
        track("button_click", { text: button.innerText?.trim() || undefined })
      }
    },
    true,
  )
}
