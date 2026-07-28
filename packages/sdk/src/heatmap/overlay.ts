import { getDocumentSize } from "../utils/helpers"
import { paintDensityHeatmap } from "./density"
import {
  resolveHeatmapPoints,
  type HeatmapResolveInput,
} from "./resolve"

const OVERLAY_ID = "arohaa-heatmap-overlay"

let overlay: HTMLCanvasElement | null = null
let scheduled = false
let lastPayload: HeatmapPaintPayload | null = null

export type HeatmapPaintPayload = {
  points: Array<HeatmapResolveInput & { value: number }>
  maxValue: number
  opacity: number
  mode?: "click" | "attention" | "scroll"
}

function ensureOverlay(): HTMLCanvasElement {
  if (overlay && overlay.isConnected) return overlay

  const existing = document.getElementById(OVERLAY_ID)
  if (existing instanceof HTMLCanvasElement) {
    overlay = existing
    return overlay
  }

  // Make the document a positioning context so the overlay covers the full
  // scrollable page (not just the viewport initial containing block).
  const root = document.documentElement
  if (getComputedStyle(root).position === "static") {
    root.style.position = "relative"
  }

  const canvas = document.createElement("canvas")
  canvas.id = OVERLAY_ID
  canvas.setAttribute("aria-hidden", "true")
  canvas.style.cssText = [
    "position:absolute",
    "left:0",
    "top:0",
    "width:0",
    "height:0",
    "pointer-events:none",
    "z-index:2147483646",
    "display:block",
  ].join(";")
  root.appendChild(canvas)
  overlay = canvas
  return canvas
}

function clearOverlay(): void {
  lastPayload = null
  if (!overlay) return
  const ctx = overlay.getContext("2d")
  if (ctx) ctx.clearRect(0, 0, overlay.width, overlay.height)
  overlay.style.display = "none"
}

function paintNow(payload: HeatmapPaintPayload): {
  width: number
  height: number
  placed: number
  elementAnchored: number
} {
  const inputs: HeatmapResolveInput[] = payload.points.map((p) => ({
    id: p.id,
    px: p.px,
    py: p.py,
    ex: p.ex,
    ey: p.ey,
    selector: p.selector,
  }))
  const resolved = resolveHeatmapPoints(inputs)
  const valueById = new Map(payload.points.map((p) => [p.id, p.value]))
  const densityPoints = resolved.points.map((p) => ({
    x: p.x,
    y: p.y,
    value: valueById.get(p.id) ?? 1,
  }))

  const canvas = ensureOverlay()
  canvas.style.display = "block"
  paintDensityHeatmap(canvas, densityPoints, {
    width: resolved.width,
    height: resolved.height,
    maxValue: Math.max(1, payload.maxValue),
    opacity: payload.opacity,
    radius:
      payload.mode === "attention"
        ? Math.max(22, Math.round(resolved.width * 0.022))
        : Math.max(16, Math.round(resolved.width * 0.015)),
    devicePixelRatio: Math.min(1.25, window.devicePixelRatio || 1),
  })

  return {
    width: resolved.width,
    height: resolved.height,
    placed: densityPoints.length,
    elementAnchored: resolved.points.filter((p) => p.method === "element")
      .length,
  }
}

function schedulePaint(payload: HeatmapPaintPayload): void {
  lastPayload = payload
  if (scheduled) return
  scheduled = true
  requestAnimationFrame(() => {
    scheduled = false
    if (!lastPayload) return
    paintNow(lastPayload)
  })
}

export function paintHeatmapOverlay(payload: HeatmapPaintPayload): {
  width: number
  height: number
  placed: number
  elementAnchored: number
} {
  lastPayload = payload
  return paintNow(payload)
}

export function clearHeatmapOverlay(): void {
  clearOverlay()
}

export function repaintHeatmapOverlay(): void {
  if (!lastPayload) return
  schedulePaint(lastPayload)
}

/** Keep the overlay sized with the live document after late layout shifts. */
export function setupHeatmapOverlayAutoRepaint(): void {
  if (typeof window === "undefined") return

  let resizeTimer = 0
  const throttledRepaint = () => {
    if (resizeTimer) return
    resizeTimer = window.setTimeout(() => {
      resizeTimer = 0
      repaintHeatmapOverlay()
    }, 180)
  }

  window.addEventListener("resize", throttledRepaint, { passive: true })
  if (typeof ResizeObserver !== "undefined" && document.documentElement) {
    const ro = new ResizeObserver(throttledRepaint)
    ro.observe(document.documentElement)
    if (document.body) ro.observe(document.body)
  }
  for (const delay of [500, 1600]) {
    window.setTimeout(() => repaintHeatmapOverlay(), delay)
  }
}

export function getLiveDocumentSize(): { width: number; height: number } {
  return getDocumentSize()
}
