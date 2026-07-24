"use client"

import { useEffect, useRef, useState } from "react"
import { cn } from "@workspace/ui/lib/utils"
import type {
  HeatmapCell,
  HeatmapDevice,
  HeatmapMode,
  HeatmapPoint,
  HeatmapScrollBucket,
} from "@/features/heatmap/model/heatmap"
import { HeatmapDeviceFrame } from "@/features/heatmap/view/HeatmapDeviceFrame"

type HeatmapCanvasProps = {
  mode: HeatmapMode
  device: HeatmapDevice
  cells: HeatmapCell[]
  points: HeatmapPoint[]
  scrollBuckets: HeatmapScrollBucket[]
  maxValue: number
  opacity: number
  backgroundImage?: string | null
  backgroundUrl?: string | null
  className?: string
  /** When true, skip heat overlay and show device + page (or empty screen). */
  emptyState?: boolean
  emptyMessage?: string
}

const DEVICE_WIDTH: Record<HeatmapDevice, number> = {
  all: 960,
  desktop: 960,
  tablet: 768,
  mobile: 390,
}

const PAGE_HEIGHT_RATIO: Record<HeatmapDevice, number> = {
  all: 2.2,
  desktop: 2.2,
  tablet: 2.6,
  mobile: 8.5,
}

const COLOR_STOPS = [
  { t: 0, r: 59, g: 130, b: 246 },
  { t: 0.35, r: 34, g: 211, b: 238 },
  { t: 0.65, r: 250, g: 204, b: 21 },
  { t: 1, r: 239, g: 68, b: 68 },
] as const

const PALETTE: ReadonlyArray<readonly [number, number, number]> = (() => {
  const out: [number, number, number][] = []
  for (let i = 0; i < 256; i += 1) {
    const t = i / 255
    let s = 0
    while (s < COLOR_STOPS.length - 2 && t > COLOR_STOPS[s + 1]!.t) s += 1
    const a = COLOR_STOPS[s]!
    const b = COLOR_STOPS[s + 1]!
    const local = (t - a.t) / Math.max(0.0001, b.t - a.t)
    out.push([
      Math.round(a.r + (b.r - a.r) * local),
      Math.round(a.g + (b.g - a.g) * local),
      Math.round(a.b + (b.b - a.b) * local),
    ])
  }
  return out
})()

function rgba(t: number, alpha: number): string {
  const idx = Math.max(0, Math.min(255, Math.round(t * 255)))
  const [r, g, b] = PALETTE[idx]!
  return `rgba(${r},${g},${b},${alpha})`
}

function renderIntensityHeatmap(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  cells: HeatmapCell[],
  maxValue: number,
  opacity: number
) {
  if (maxValue <= 0 || cells.length === 0) return

  const off = document.createElement("canvas")
  off.width = width
  off.height = height
  const octx = off.getContext("2d")
  if (!octx) return

  const cellW = width / 10
  const cellH = height / 10
  const baseRadius = Math.max(cellW, Math.min(cellH, width * 0.12)) * 1.15

  for (const cell of cells) {
    const col = Math.max(0, Math.min(9, Math.floor(cell.gridX / 10)))
    const row = Math.max(0, Math.min(9, Math.floor(cell.gridY / 10)))
    const weight = cell.value / maxValue
    if (weight <= 0) continue
    const cx = (col + 0.5) * cellW
    const cy = (row + 0.5) * cellH
    const radius = baseRadius * (0.75 + weight * 0.5)

    octx.globalAlpha = Math.max(0.08, weight)
    const grad = octx.createRadialGradient(cx, cy, 0, cx, cy, radius)
    grad.addColorStop(0, "rgba(0,0,0,1)")
    grad.addColorStop(1, "rgba(0,0,0,0)")
    octx.fillStyle = grad
    octx.beginPath()
    octx.arc(cx, cy, radius, 0, Math.PI * 2)
    octx.fill()
  }
  octx.globalAlpha = 1

  const img = octx.getImageData(0, 0, width, height)
  const data = img.data
  for (let i = 0; i < data.length; i += 4) {
    const density = data[i + 3]! / 255
    if (density < 0.12) {
      data[i + 3] = 0
      continue
    }
    const t = Math.min(1, Math.pow(density, 0.75))
    const [r, g, b] = PALETTE[Math.round(t * 255)]!
    data[i] = r
    data[i + 1] = g
    data[i + 2] = b
    data[i + 3] = Math.round(255 * opacity * Math.min(1, 0.2 + density))
  }
  octx.putImageData(img, 0, 0)

  ctx.drawImage(off, 0, 0, width, height)
}

function renderPointsHeatmap(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  points: HeatmapPoint[],
  maxValue: number,
  opacity: number
) {
  if (points.length === 0) return

  const off = document.createElement("canvas")
  off.width = width
  off.height = height
  const octx = off.getContext("2d")
  if (!octx) return

  const radius = Math.max(26, width * 0.055)
  const max = Math.max(1, maxValue)

  for (const p of points) {
    const cx = p.x * width
    const cy = p.y * height
    const weight = Math.max(0, Math.min(1, p.value / max))
    const cx0 = Math.max(0, Math.min(width, cx))
    const cy0 = Math.max(0, Math.min(height, cy))

    octx.globalAlpha = Math.max(0.16, Math.min(0.8, 0.2 + weight * 0.55))
    const grad = octx.createRadialGradient(cx0, cy0, 0, cx0, cy0, radius)
    grad.addColorStop(0, "rgba(0,0,0,1)")
    grad.addColorStop(1, "rgba(0,0,0,0)")
    octx.fillStyle = grad
    octx.beginPath()
    octx.arc(cx0, cy0, radius, 0, Math.PI * 2)
    octx.fill()
  }
  octx.globalAlpha = 1

  const img = octx.getImageData(0, 0, width, height)
  const data = img.data
  for (let i = 0; i < data.length; i += 4) {
    const density = data[i + 3]! / 255
    if (density < 0.1) {
      data[i + 3] = 0
      continue
    }
    const t = Math.min(1, Math.pow(density, 0.7))
    const [r, g, b] = PALETTE[Math.round(t * 255)]!
    data[i] = r
    data[i + 1] = g
    data[i + 2] = b
    data[i + 3] = Math.round(255 * opacity * Math.min(1, 0.25 + density))
  }
  octx.putImageData(img, 0, 0)

  ctx.drawImage(off, 0, 0, width, height)
}

function drawScrollOverlay(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  buckets: HeatmapScrollBucket[],
  opacity: number
) {
  const total = buckets.reduce((s, b) => s + b.value, 0)
  if (total <= 0) return

  const grad = ctx.createLinearGradient(0, 0, 0, height)
  for (let r = 0; r <= 10; r += 1) {
    const depth = r * 10
    const reached = buckets.reduce(
      (s, b) => (b.bucket >= depth ? s + b.value : s),
      0
    )
    const reach = reached / total
    grad.addColorStop(r / 10, rgba(reach, opacity * (0.15 + 0.55 * reach)))
  }
  ctx.fillStyle = grad
  ctx.fillRect(0, 0, width, height)
}

export function HeatmapCanvas({
  mode,
  device,
  cells,
  points,
  scrollBuckets,
  maxValue,
  opacity,
  backgroundImage,
  backgroundUrl,
  className,
  emptyState = false,
  emptyMessage = "No heatmap data for this range yet. Clicks, scroll depth, and attention will appear here after the SDK starts collecting.",
}: HeatmapCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const iframeRef = useRef<HTMLIFrameElement>(null)
  const frameWidth = DEVICE_WIDTH[device]
  const viewportHeight = Math.round(
    frameWidth * (device === "mobile" ? 1.9 : device === "tablet" ? 1.25 : 0.62)
  )

  const [pageLoaded, setPageLoaded] = useState(false)
  const [pageFailed, setPageFailed] = useState(false)
  const [measuredHeight, setMeasuredHeight] = useState<number | null>(null)

  const hasLivePage = Boolean(backgroundUrl && !backgroundImage)

  // For a live embedded page, seed the height at a realistic device viewport so
  // that `100vh`-based layouts resolve correctly. Using the tall PAGE_HEIGHT_RATIO
  // estimate here would inflate `vh` inside the iframe, forcing the page taller
  // than its real content (trailing white space) and stretching the overlay.
  const pageHeight =
    measuredHeight ??
    (hasLivePage
      ? viewportHeight
      : Math.round(frameWidth * PAGE_HEIGHT_RATIO[device]))

  useEffect(() => {
    setPageLoaded(false)
    setPageFailed(false)
    setMeasuredHeight(null)
  }, [backgroundUrl, device])

  useEffect(() => {
    if (!hasLivePage) return
    const onMessage = (event: MessageEvent) => {
      if (event.source !== iframeRef.current?.contentWindow) return
      const data = event.data as
        | { source?: string; type?: string; height?: number }
        | undefined
      if (!data || data.source !== "arohaa-heatmap" || data.type !== "doc-size")
        return
      const height = Number(data.height)
      if (!Number.isFinite(height) || height <= 0) return
      const clamped = Math.max(
        Math.round(frameWidth * 0.5),
        Math.min(Math.round(frameWidth * 30), Math.round(height))
      )
      setMeasuredHeight((prev) => (prev === clamped ? prev : clamped))
    }
    window.addEventListener("message", onMessage)
    return () => window.removeEventListener("message", onMessage)
  }, [frameWidth, hasLivePage, backgroundUrl])

  useEffect(() => {
    if (emptyState) return
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext("2d")
    if (!ctx) return

    const dpr = window.devicePixelRatio || 1
    canvas.width = Math.floor(frameWidth * dpr)
    canvas.height = Math.floor(pageHeight * dpr)
    canvas.style.width = `${frameWidth}px`
    canvas.style.height = `${pageHeight}px`
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)

    ctx.clearRect(0, 0, frameWidth, pageHeight)

    if (!hasLivePage && !backgroundImage) {
      ctx.fillStyle = "#f4f4f5"
      ctx.fillRect(0, 0, frameWidth, pageHeight)

      const step = 24
      ctx.fillStyle = "#e4e4e7"
      for (let y = 0; y < pageHeight; y += step) {
        for (let x = 0; x < frameWidth; x += step) {
          if ((x / step + y / step) % 2 === 0) {
            ctx.fillRect(x, y, step, step)
          }
        }
      }
    }

    const paintOverlay = () => {
      if (mode === "scroll") {
        drawScrollOverlay(ctx, frameWidth, pageHeight, scrollBuckets, opacity)
      } else if (points.length > 0) {
        renderPointsHeatmap(
          ctx,
          frameWidth,
          pageHeight,
          points,
          maxValue,
          opacity
        )
      } else {
        renderIntensityHeatmap(
          ctx,
          frameWidth,
          pageHeight,
          cells,
          maxValue,
          opacity
        )
      }
    }

    if (backgroundImage) {
      const img = new Image()
      img.onload = () => {
        ctx.drawImage(img, 0, 0, frameWidth, pageHeight)
        paintOverlay()
      }
      img.src = backgroundImage
      return
    }

    paintOverlay()
  }, [
    backgroundImage,
    cells,
    device,
    emptyState,
    frameWidth,
    hasLivePage,
    maxValue,
    mode,
    opacity,
    pageHeight,
    points,
    scrollBuckets,
  ])

  const contentHeight =
    hasLivePage || backgroundImage ? pageHeight : viewportHeight

  return (
    <div
      className={cn(
        "rounded-xl border border-neutral-200 bg-neutral-100/80",
        className
      )}
    >
      <HeatmapDeviceFrame
        device={device}
        screenWidth={frameWidth}
        screenHeight={viewportHeight}
      >
        <div
          className="relative bg-white"
          style={{ width: frameWidth, height: contentHeight, maxWidth: "100%" }}
        >
          {hasLivePage ? (
            <iframe
              key={`${backgroundUrl}-${device}`}
              ref={iframeRef}
              src={backgroundUrl ?? undefined}
              title="Landing page preview"
              className="pointer-events-none absolute top-0 left-0 z-0 border-0"
              style={{
                width: frameWidth,
                height: pageHeight,
                maxWidth: "100%",
              }}
              sandbox="allow-scripts allow-same-origin"
              loading="lazy"
              referrerPolicy="no-referrer"
              scrolling="no"
              onLoad={() => setPageLoaded(true)}
              onError={() => setPageFailed(true)}
            />
          ) : null}

          {!hasLivePage && !backgroundImage ? (
            <div className="absolute inset-0 z-0 bg-gradient-to-b from-neutral-50 to-neutral-100">
              <div className="border-b border-neutral-200 bg-white px-4 py-3">
                <div className="h-2.5 w-24 rounded bg-neutral-200" />
                <div className="mt-2 h-2 w-40 rounded bg-neutral-100" />
              </div>
              <div className="space-y-3 p-4">
                <div className="h-28 rounded-lg bg-neutral-200/80" />
                <div className="h-2.5 w-3/4 rounded bg-neutral-200" />
                <div className="h-2.5 w-1/2 rounded bg-neutral-100" />
                <div className="grid grid-cols-2 gap-2 pt-2">
                  <div className="h-16 rounded-md bg-neutral-200/70" />
                  <div className="h-16 rounded-md bg-neutral-200/70" />
                </div>
              </div>
            </div>
          ) : null}

          {hasLivePage && !pageLoaded && !pageFailed ? (
            <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center bg-neutral-50 text-xs text-neutral-400">
              Loading page preview…
            </div>
          ) : null}

          {hasLivePage && pageFailed ? (
            <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center bg-neutral-50 px-6 text-center text-xs text-neutral-400">
              Could not embed this page. Showing overlay only.
            </div>
          ) : null}

          {emptyState ? (
            <div className="pointer-events-none absolute inset-0 z-30 flex items-center justify-center bg-white/70 px-6 backdrop-blur-[1px]">
              <p className="max-w-sm text-center text-sm leading-relaxed text-neutral-600">
                {emptyMessage}
              </p>
            </div>
          ) : (
            <canvas
              ref={canvasRef}
              aria-label={`${mode} heatmap overlay`}
              className="pointer-events-none absolute top-0 left-0 z-20"
            />
          )}
        </div>
      </HeatmapDeviceFrame>
    </div>
  )
}
