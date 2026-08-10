import { track } from "../core/tracker"
import { getDocumentSize, getPageNorm } from "../utils/helpers"
import { getStableSelector } from "../utils/selector"
import { resolveHeatmapFieldName } from "./form-field-key"

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
const focusedFieldKeys = new Set<string>()
let fieldFocusInstalled = false

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
  const { width: dw, height: dh } = getDocumentSize()
  const selector = getStableSelector(target)
  const fieldName = resolveHeatmapFieldName(target)
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
    dw,
    dh,
    selector,
    vw: window.innerWidth,
    vh: window.innerHeight,
    device: resolveDevice(),
    rage,
    ...(fieldName ? { fieldName } : {}),
  })
}

function trackHeatmapFieldFocus(target: EventTarget | null): void {
  if (!(target instanceof HTMLElement)) return
  const fieldName = resolveHeatmapFieldName(target)
  if (!fieldName) return
  const key = `${fieldName}:${getStableSelector(target)}`
  if (focusedFieldKeys.has(key)) return
  focusedFieldKeys.add(key)

  const vw = window.innerWidth || 1
  const vh = window.innerHeight || 1
  const rect = target.getBoundingClientRect()
  const cx = rect.left + rect.width / 2
  const cy = rect.top + rect.height / 2
  const { px, py } = getPageNorm(cx, cy)
  const { width: dw, height: dh } = getDocumentSize()

  track("heatmap_field_focus", {
    fieldName,
    selector: getStableSelector(target),
    px,
    py,
    vx: clamp01(cx / vw),
    vy: clamp01(cy / vh),
    dw,
    dh,
    vw: window.innerWidth,
    vh: window.innerHeight,
    device: resolveDevice(),
  })
}

function setupHeatmapFieldFocusTracking(): void {
  if (fieldFocusInstalled || typeof document === "undefined") return
  fieldFocusInstalled = true
  document.addEventListener(
    "focusin",
    (e) => {
      trackHeatmapFieldFocus(e.target)
    },
    true,
  )
}

export function setupClickTracking(): void {
  setupHeatmapFieldFocusTracking()

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
