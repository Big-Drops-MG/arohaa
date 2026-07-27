/**
 * Production density heatmap painter (heatmap.js / Crazy Egg style).
 *
 * 1. Splat each point as a radial alpha kernel (Gaussian-like falloff)
 * 2. Colorize the alpha channel with a heat palette
 * 3. Apply global opacity
 *
 * Coordinates are absolute CSS pixels in the target canvas space.
 */

export type DensityPoint = {
  x: number
  y: number
  value: number
}

export type DensityPaintOptions = {
  width: number
  height: number
  maxValue: number
  opacity: number
  /** Kernel radius in CSS pixels. */
  radius?: number
  devicePixelRatio?: number
}

const COLOR_STOPS = [
  { t: 0, r: 59, g: 130, b: 246 },
  { t: 0.25, r: 34, g: 211, b: 238 },
  { t: 0.5, r: 250, g: 204, b: 21 },
  { t: 0.75, r: 249, g: 115, b: 22 },
  { t: 1, r: 239, g: 68, b: 68 },
] as const

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

/** Soft radial brush used as the density kernel. */
function createBrush(radius: number): HTMLCanvasElement {
  const size = Math.max(2, Math.ceil(radius * 2))
  const brush = document.createElement("canvas")
  brush.width = size
  brush.height = size
  const ctx = brush.getContext("2d")
  if (!ctx) return brush
  const r = size / 2
  const grad = ctx.createRadialGradient(r, r, 0, r, r, r)
  // Approximate Gaussian: opaque center, soft shoulders, transparent edge.
  grad.addColorStop(0, "rgba(0,0,0,1)")
  grad.addColorStop(0.35, "rgba(0,0,0,0.55)")
  grad.addColorStop(0.7, "rgba(0,0,0,0.18)")
  grad.addColorStop(1, "rgba(0,0,0,0)")
  ctx.fillStyle = grad
  ctx.fillRect(0, 0, size, size)
  return brush
}

export function paintDensityHeatmap(
  target: HTMLCanvasElement,
  points: DensityPoint[],
  options: DensityPaintOptions
): void {
  const {
    width,
    height,
    maxValue,
    opacity,
    radius = Math.max(18, Math.round(width * 0.018)),
    devicePixelRatio = 1,
  } = options

  const dpr = Math.max(1, devicePixelRatio)
  target.width = Math.max(1, Math.floor(width * dpr))
  target.height = Math.max(1, Math.floor(height * dpr))
  target.style.width = `${width}px`
  target.style.height = `${height}px`

  const ctx = target.getContext("2d")
  if (!ctx) return
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
  ctx.clearRect(0, 0, width, height)

  if (points.length === 0 || maxValue <= 0 || width <= 0 || height <= 0) return

  const off = document.createElement("canvas")
  off.width = Math.max(1, Math.floor(width * dpr))
  off.height = Math.max(1, Math.floor(height * dpr))
  const octx = off.getContext("2d")
  if (!octx) return
  octx.setTransform(dpr, 0, 0, dpr, 0, 0)

  const brush = createBrush(radius)
  const brushSize = brush.width
  const max = Math.max(1, maxValue)

  // Accumulate density in the alpha channel (classic heatmap.js approach).
  for (const point of points) {
    const weight = Math.max(0, Math.min(1, point.value / max))
    if (weight <= 0) continue
    octx.globalAlpha = Math.max(0.05, weight)
    octx.drawImage(brush, point.x - brushSize / 2, point.y - brushSize / 2)
  }
  octx.globalAlpha = 1

  const img = octx.getImageData(0, 0, off.width, off.height)
  const data = img.data
  for (let i = 0; i < data.length; i += 4) {
    const density = data[i + 3]! / 255
    if (density < 0.04) {
      data[i + 3] = 0
      continue
    }
    // Slight gamma so sparse clicks stay visible without blowing out hotspots.
    const t = Math.min(1, Math.pow(density, 0.65))
    const [r, g, b] = paletteColor(t)
    data[i] = r
    data[i + 1] = g
    data[i + 2] = b
    data[i + 3] = Math.round(255 * opacity * Math.min(1, 0.2 + density * 0.95))
  }
  octx.putImageData(img, 0, 0)
  ctx.drawImage(off, 0, 0, width, height)
}
