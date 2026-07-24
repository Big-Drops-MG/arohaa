"use client"

import { useEffect, useRef } from "react"
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
  className?: string
}

const DEVICE_WIDTH: Record<HeatmapDevice, number> = {
  all: 960,
  desktop: 960,
  tablet: 768,
  mobile: 390,
}

function intensityColor(t: number, alpha: number): string {
  const clamped = Math.max(0, Math.min(1, t))
  // blue -> cyan -> yellow -> red
  const stops = [
    { t: 0, r: 59, g: 130, b: 246 },
    { t: 0.35, r: 34, g: 211, b: 238 },
    { t: 0.65, r: 250, g: 204, b: 21 },
    { t: 1, r: 239, g: 68, b: 68 },
  ]
  let i = 0
  while (i < stops.length - 2 && clamped > stops[i + 1]!.t) i += 1
  const a = stops[i]!
  const b = stops[i + 1]!
  const local = (clamped - a.t) / Math.max(0.0001, b.t - a.t)
  const r = Math.round(a.r + (b.r - a.r) * local)
  const g = Math.round(a.g + (b.g - a.g) * local)
  const bl = Math.round(a.b + (b.b - a.b) * local)
  return `rgba(${r},${g},${bl},${alpha})`
}

function drawGridOverlay(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  cells: HeatmapCell[],
  maxValue: number,
  opacity: number
) {
  if (maxValue <= 0 || cells.length === 0) return

  const cellW = width / 10
  const cellH = height / 10

  for (const cell of cells) {
    const col = Math.max(0, Math.min(9, Math.floor(cell.gridX / 10)))
    const row = Math.max(0, Math.min(9, Math.floor(cell.gridY / 10)))
    const t = cell.value / maxValue
    const cx = (col + 0.5) * cellW
    const cy = (row + 0.5) * cellH
    const radius = Math.max(cellW, cellH) * (0.55 + t * 0.45)

    const gradient = ctx.createRadialGradient(cx, cy, 0, cx, cy, radius)
    gradient.addColorStop(0, intensityColor(t, opacity * (0.55 + t * 0.45)))
    gradient.addColorStop(0.55, intensityColor(t, opacity * 0.22))
    gradient.addColorStop(1, intensityColor(t, 0))

    ctx.fillStyle = gradient
    ctx.beginPath()
    ctx.arc(cx, cy, radius, 0, Math.PI * 2)
    ctx.fill()
  }
}

function drawScrollOverlay(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  buckets: HeatmapScrollBucket[],
  maxValue: number,
  opacity: number
) {
  if (maxValue <= 0 || buckets.length === 0) return

  const bandH = height / 10
  for (const bucket of buckets) {
    const row = Math.max(0, Math.min(9, Math.floor(bucket.bucket / 10)))
    const t = bucket.value / maxValue
    ctx.fillStyle = intensityColor(t, opacity * (0.25 + t * 0.55))
    ctx.fillRect(0, row * bandH, width, bandH)
  }
}

export function HeatmapCanvas({
  mode,
  device,
  cells,
  scrollBuckets,
  maxValue,
  opacity,
  backgroundImage,
  className,
}: HeatmapCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const frameWidth = DEVICE_WIDTH[device]
  const frameHeight = Math.round(
    frameWidth * (device === "mobile" ? 1.9 : 0.72)
  )

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext("2d")
    if (!ctx) return

    const dpr = window.devicePixelRatio || 1
    canvas.width = Math.floor(frameWidth * dpr)
    canvas.height = Math.floor(frameHeight * dpr)
    canvas.style.width = `${frameWidth}px`
    canvas.style.height = `${frameHeight}px`
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)

    ctx.clearRect(0, 0, frameWidth, frameHeight)

    // Placeholder page frame
    ctx.fillStyle = "#f4f4f5"
    ctx.fillRect(0, 0, frameWidth, frameHeight)

    // Checker pattern so empty states still read as a page surface
    const step = 24
    ctx.fillStyle = "#e4e4e7"
    for (let y = 0; y < frameHeight; y += step) {
      for (let x = 0; x < frameWidth; x += step) {
        if ((x / step + y / step) % 2 === 0) {
          ctx.fillRect(x, y, step, step)
        }
      }
    }

    if (backgroundImage) {
      const img = new Image()
      img.onload = () => {
        ctx.drawImage(img, 0, 0, frameWidth, frameHeight)
        if (mode === "scroll") {
          drawScrollOverlay(
            ctx,
            frameWidth,
            frameHeight,
            scrollBuckets,
            maxValue,
            opacity
          )
        } else {
          drawGridOverlay(
            ctx,
            frameWidth,
            frameHeight,
            cells,
            maxValue,
            opacity
          )
        }
      }
      img.src = backgroundImage
      return
    }

    if (mode === "scroll") {
      drawScrollOverlay(
        ctx,
        frameWidth,
        frameHeight,
        scrollBuckets,
        maxValue,
        opacity
      )
    } else {
      drawGridOverlay(ctx, frameWidth, frameHeight, cells, maxValue, opacity)
    }
  }, [
    backgroundImage,
    cells,
    device,
    frameHeight,
    frameWidth,
    maxValue,
    mode,
    opacity,
    scrollBuckets,
  ])

  return (
    <div
      className={cn(
        "overflow-auto rounded-lg border border-neutral-200 bg-neutral-100 p-4",
        className
      )}
    >
      <div
        className="mx-auto overflow-hidden rounded-md border border-neutral-300 bg-white shadow-sm"
        style={{ width: frameWidth, maxWidth: "100%" }}
      >
        <canvas ref={canvasRef} aria-label={`${mode} heatmap overlay`} />
      </div>
    </div>
  )
}
