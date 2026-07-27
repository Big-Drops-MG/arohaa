/**
 * Fallback density painter used when the live page SDK cannot paint in-page.
 * Mirrors packages/sdk/src/heatmap/density.ts (capped internal resolution).
 */

export type DensityPoint = {
  x: number
  y: number
  value: number
}

const COLOR_STOPS = [
  { t: 0, r: 59, g: 130, b: 246 },
  { t: 0.25, r: 34, g: 211, b: 238 },
  { t: 0.5, r: 250, g: 204, b: 21 },
  { t: 0.75, r: 249, g: 115, b: 22 },
  { t: 1, r: 239, g: 68, b: 68 },
] as const

const MAX_INTERNAL_EDGE = 1600
const brushCache = new Map<number, HTMLCanvasElement>()

function paletteColor(t: number): [number, number, number] {
  const clamped = Math.max(0, Math.min(1, t))
  let i = 0
  while (i < COLOR_STOPS.length - 2 && clamped > COLOR_STOPS[i + 1]!.t) i += 1
  const a = COLOR_STOPS[i]!
  const b = COLOR_STOPS[i + 1]!
  const local = (clamped - a.t) / Math.max(0.0001, b.t - a.t)
  return [
    Math.round(a.r + (b.r - a.r) * local),
    Math.round(a.g + (b.g - a.g) * local),
    Math.round(a.b + (b.b - a.b) * local),
  ]
}

function createBrush(radius: number): HTMLCanvasElement {
  const key = Math.max(2, Math.round(radius))
  const cached = brushCache.get(key)
  if (cached) return cached

  const size = Math.max(2, key * 2)
  const brush = document.createElement("canvas")
  brush.width = size
  brush.height = size
  const ctx = brush.getContext("2d")
  if (!ctx) return brush
  const r = size / 2
  const grad = ctx.createRadialGradient(r, r, 0, r, r, r)
  grad.addColorStop(0, "rgba(0,0,0,1)")
  grad.addColorStop(0.35, "rgba(0,0,0,0.55)")
  grad.addColorStop(0.7, "rgba(0,0,0,0.18)")
  grad.addColorStop(1, "rgba(0,0,0,0)")
  ctx.fillStyle = grad
  ctx.fillRect(0, 0, size, size)
  if (brushCache.size > 24) brushCache.clear()
  brushCache.set(key, brush)
  return brush
}

export function paintDensityHeatmap(
  target: HTMLCanvasElement,
  points: DensityPoint[],
  options: {
    width: number
    height: number
    maxValue: number
    opacity: number
    radius?: number
    devicePixelRatio?: number
  }
): void {
  const {
    width,
    height,
    maxValue,
    opacity,
    radius = Math.max(18, Math.round(width * 0.018)),
    devicePixelRatio,
  } = options

  if (width <= 0 || height <= 0) return

  const displayDpr = Math.min(
    1.25,
    Math.max(1, devicePixelRatio ?? window.devicePixelRatio ?? 1)
  )
  target.width = Math.max(1, Math.floor(width * displayDpr))
  target.height = Math.max(1, Math.floor(height * displayDpr))
  target.style.width = `${width}px`
  target.style.height = `${height}px`

  const ctx = target.getContext("2d")
  if (!ctx) return
  ctx.setTransform(displayDpr, 0, 0, displayDpr, 0, 0)
  ctx.clearRect(0, 0, width, height)
  if (points.length === 0 || maxValue <= 0) return

  const scale = Math.min(1, MAX_INTERNAL_EDGE / Math.max(width, height))
  const pw = Math.max(1, Math.floor(width * scale))
  const ph = Math.max(1, Math.floor(height * scale))
  const paintRadius = Math.max(6, Math.round(radius * scale))

  const off = document.createElement("canvas")
  off.width = pw
  off.height = ph
  const octx = off.getContext("2d", { willReadFrequently: true })
  if (!octx) return

  const brush = createBrush(paintRadius)
  const brushSize = brush.width
  const max = Math.max(1, maxValue)

  for (const point of points) {
    const weight = Math.max(0, Math.min(1, point.value / max))
    if (weight <= 0) continue
    octx.globalAlpha = Math.max(0.05, weight)
    octx.drawImage(
      brush,
      point.x * scale - brushSize / 2,
      point.y * scale - brushSize / 2
    )
  }
  octx.globalAlpha = 1

  const img = octx.getImageData(0, 0, pw, ph)
  const data = img.data
  for (let i = 0; i < data.length; i += 4) {
    const density = data[i + 3]! / 255
    if (density < 0.04) {
      data[i + 3] = 0
      continue
    }
    const t = Math.min(1, Math.pow(density, 0.65))
    const [r, g, b] = paletteColor(t)
    data[i] = r
    data[i + 1] = g
    data[i + 2] = b
    data[i + 3] = Math.round(255 * opacity * Math.min(1, 0.2 + density * 0.95))
  }
  octx.putImageData(img, 0, 0)
  ctx.imageSmoothingEnabled = true
  ctx.drawImage(off, 0, 0, width, height)
}

export function rgbaScroll(t: number, alpha: number): string {
  const [r, g, b] = paletteColor(t)
  return `rgba(${r},${g},${b},${alpha})`
}
