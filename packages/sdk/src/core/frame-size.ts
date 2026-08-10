import { getDocumentSize } from "../utils/helpers"
import {
  clearHeatmapOverlay,
  paintHeatmapOverlay,
  setupHeatmapOverlayAutoRepaint,
  type HeatmapPaintPayload,
} from "../heatmap/overlay"
import {
  clearHeatmapPreviewStep,
  heatmapPrefillState,
  startHeatmapPreviewStep,
} from "../heatmap/preview-step"

const MESSAGE_SOURCE = "arohaa-heatmap"

function isFramed(): boolean {
  try {
    return window.top !== window.self
  } catch {
    return true
  }
}

function postDocSize(): void {
  const { width, height } = getDocumentSize()
  const target = window.parent
  if (!target) return
  target.postMessage(
    {
      source: MESSAGE_SOURCE,
      type: "doc-size",
      width,
      height,
      features: [
        "scroll-to",
        "heatmap-paint",
        "heatmap-show-step",
        "heatmap-prefill",
      ],
      prefill: heatmapPrefillState(),
    },
    "*"
  )
}

function postStepShown(slug: string): void {
  const target = window.parent
  if (!target) return
  const { width, height } = getDocumentSize()
  target.postMessage(
    {
      source: MESSAGE_SOURCE,
      type: "heatmap-step-shown",
      slug,
      width,
      height,
    },
    "*"
  )
}

function ackPaint(
  requestId: string | number | undefined,
  result: {
    width: number
    height: number
    placed: number
    elementAnchored: number
  }
): void {
  const target = window.parent
  if (!target) return
  target.postMessage(
    {
      source: MESSAGE_SOURCE,
      type: "heatmap-painted",
      requestId,
      ...result,
    },
    "*"
  )
}

function onParentMessage(event: MessageEvent): void {
  const data = event.data as
    | {
        source?: string
        type?: string
        x?: number
        y?: number
        slug?: string
        hash?: string
        requestId?: string | number
        points?: HeatmapPaintPayload["points"]
        maxValue?: number
        opacity?: number
        mode?: HeatmapPaintPayload["mode"]
      }
    | undefined
  if (!data || data.source !== MESSAGE_SOURCE) return

  if (data.type === "ping") {
    postDocSize()
    return
  }

  if (data.type === "scroll-to") {
    const x = Number(data.x)
    const y = Number(data.y)
    window.scrollTo({
      left: Number.isFinite(x) ? x : 0,
      top: Number.isFinite(y) ? y : 0,
      behavior: "auto",
    })
    return
  }

  if (data.type === "heatmap-show-step") {
    const slug =
      typeof data.slug === "string" && data.slug.trim()
        ? data.slug.trim()
        : typeof data.hash === "string"
          ? data.hash
          : ""
    const changed = startHeatmapPreviewStep(slug, () => {
      requestAnimationFrame(() => postStepShown(slug))
    })
    if (changed) {
      requestAnimationFrame(() => postStepShown(slug))
    }
    postDocSize()
    return
  }

  if (data.type === "heatmap-clear") {
    clearHeatmapOverlay()
    return
  }

  if (data.type === "heatmap-paint") {
    const points = Array.isArray(data.points) ? data.points : []
    const result = paintHeatmapOverlay({
      points,
      maxValue: Number(data.maxValue) || 1,
      opacity:
        typeof data.opacity === "number" && Number.isFinite(data.opacity)
          ? data.opacity
          : 0.65,
      mode: data.mode,
    })
    ackPaint(data.requestId, result)
  }
}

export function setupFrameSizeReporter(): void {
  if (typeof window === "undefined") return
  if (!isFramed()) return

  let scheduled = false
  const schedule = () => {
    if (scheduled) return
    scheduled = true
    requestAnimationFrame(() => {
      scheduled = false
      postDocSize()
    })
  }

  setupHeatmapOverlayAutoRepaint()
  schedule()
  window.addEventListener("load", schedule)
  window.addEventListener("resize", schedule)
  window.addEventListener("message", onParentMessage)
  window.addEventListener("pagehide", () => {
    clearHeatmapPreviewStep()
  })

  if (typeof ResizeObserver !== "undefined" && document.documentElement) {
    const ro = new ResizeObserver(schedule)
    ro.observe(document.documentElement)
    if (document.body) ro.observe(document.body)
  }

  for (const delay of [400, 1200, 2400]) {
    window.setTimeout(schedule, delay)
  }
}
