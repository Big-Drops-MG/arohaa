"use client"

import { useEffect, useRef, useState } from "react"
import { cn } from "@workspace/ui/lib/utils"
import type {
  HeatmapCell,
  HeatmapDevice,
  HeatmapMode,
  HeatmapScrollBucket,
} from "@/features/heatmap/model/heatmap"

type HeatmapCanvasProps = {
  mode: HeatmapMode
  device: HeatmapDevice
  cells: HeatmapCell[]
  scrollBuckets: HeatmapScrollBucket[]
  maxValue: number
  opacity: number
  backgroundImage?: string | null
  backgroundUrl?: string | null
  className?: string
}

const DEVICE_WIDTH: Record<HeatmapDevice, number> = {
  all: 960,
  desktop: 960,
  tablet: 768,
  mobile: 390,
}

/** Tall enough for typical landing pages; iframe expands so our shell owns scroll. */
const PAGE_HEIGHT_RATIO: Record<HeatmapDevice, number> = {
  all: 3.2,
  desktop: 3.2,
  tablet: 4,
  mobile: 5.5,
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
  const radius = Math.max(width, height) * 0.11

  for (const cell of cells) {
    const col = Math.max(0, Math.min(9, Math.floor(cell.gridX / 10)))
    const row = Math.max(0, Math.min(9, Math.floor(cell.gridY / 10)))
    const weight = cell.value / maxValue
    if (weight <= 0) continue
    const cx = (col + 0.5) * cellW
    const cy = (row + 0.5) * cellH

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
  scrollBuckets,
  maxValue,
  opacity,
  backgroundImage,
  backgroundUrl,
  className,
}: HeatmapCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const frameWidth = DEVICE_WIDTH[device]
  const viewportHeight = Math.round(
    frameWidth * (device === "mobile" ? 1.9 : 0.72)
  )
  const pageHeight = Math.round(frameWidth * PAGE_HEIGHT_RATIO[device])
  // Click/attention coords are viewport-relative → paint only the first screen.
  // Scroll depth spans the full page → paint the full scrollable height.
  const overlayHeight = mode === "scroll" ? pageHeight : viewportHeight

  const [pageLoaded, setPageLoaded] = useState(false)
  const [pageFailed, setPageFailed] = useState(false)

  const hasLivePage = Boolean(backgroundUrl && !backgroundImage)

  useEffect(() => {
    setPageLoaded(false)
    setPageFailed(false)
  }, [backgroundUrl])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext("2d")
    if (!ctx) return

    const dpr = window.devicePixelRatio || 1
    canvas.width = Math.floor(frameWidth * dpr)
    canvas.height = Math.floor(overlayHeight * dpr)
    canvas.style.width = `${frameWidth}px`
    canvas.style.height = `${overlayHeight}px`
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)

    ctx.clearRect(0, 0, frameWidth, overlayHeight)

    if (!hasLivePage && !backgroundImage) {
      ctx.fillStyle = "#f4f4f5"
      ctx.fillRect(0, 0, frameWidth, overlayHeight)

      const step = 24
      ctx.fillStyle = "#e4e4e7"
      for (let y = 0; y < overlayHeight; y += step) {
        for (let x = 0; x < frameWidth; x += step) {
          if ((x / step + y / step) % 2 === 0) {
            ctx.fillRect(x, y, step, step)
          }
        }
      }
    }

    const paintOverlay = () => {
      if (mode === "scroll") {
        drawScrollOverlay(
          ctx,
          frameWidth,
          overlayHeight,
          scrollBuckets,
          opacity
        )
      } else {
        renderIntensityHeatmap(
          ctx,
          frameWidth,
          overlayHeight,
          cells,
          maxValue,
          opacity
        )
      }
    }

    if (backgroundImage) {
      const img = new Image()
      img.onload = () => {
        ctx.drawImage(img, 0, 0, frameWidth, overlayHeight)
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
    frameWidth,
    hasLivePage,
    maxValue,
    mode,
    opacity,
    overlayHeight,
    scrollBuckets,
  ])

  return (
    <div
      className={cn(
        "rounded-lg border border-neutral-200 bg-neutral-100 p-4",
        className
      )}
    >
      <div
        className="mx-auto overflow-auto rounded-md border border-neutral-300 bg-white shadow-sm"
        style={{
          width: frameWidth,
          height: viewportHeight,
          maxWidth: "100%",
        }}
      >
        <div
          className="relative"
          style={{ width: frameWidth, height: pageHeight }}
        >
          {hasLivePage ? (
            <iframe
              key={backgroundUrl}
              src={backgroundUrl ?? undefined}
              title="Landing page preview"
              className="pointer-events-none absolute top-0 left-0 z-0 w-full border-0"
              style={{ height: pageHeight }}
              sandbox="allow-scripts allow-same-origin"
              loading="lazy"
              referrerPolicy="no-referrer"
              scrolling="no"
              onLoad={() => setPageLoaded(true)}
              onError={() => setPageFailed(true)}
            />
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

          <canvas
            ref={canvasRef}
            aria-label={`${mode} heatmap overlay`}
            className="pointer-events-none absolute top-0 left-0 z-20"
          />
        </div>
      </div>
    </div>
  )
}
