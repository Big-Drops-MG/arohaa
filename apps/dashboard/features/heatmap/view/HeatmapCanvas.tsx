"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { cn } from "@workspace/ui/lib/utils"
import type {
  HeatmapCell,
  HeatmapDevice,
  HeatmapMode,
  HeatmapPoint,
  HeatmapScrollBucket,
} from "@/features/heatmap/model/heatmap"
import {
  paintDensityHeatmap,
  rgbaScroll,
} from "@/features/heatmap/utils/heatmap-density"
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
  emptyState?: boolean
  emptyMessage?: string
  previewSrc?: string | null
}

const DEVICE_WIDTH: Record<HeatmapDevice, number> = {
  all: 1280,
  desktop: 1280,
  tablet: 768,
  mobile: 390,
}

const PAGE_HEIGHT_RATIO: Record<HeatmapDevice, number> = {
  all: 2.2,
  desktop: 2.2,
  tablet: 2.6,
  mobile: 8.5,
}

const MESSAGE_SOURCE = "arohaa-heatmap"

type PaintTarget = "unknown" | "inpage" | "parent"

function cellsToPoints(
  cells: HeatmapCell[],
  width: number,
  height: number
): Array<{ x: number; y: number; value: number }> {
  const cellW = width / 10
  const cellH = height / 10
  return cells.map((cell) => {
    const col = Math.max(0, Math.min(9, Math.floor(cell.gridX / 10)))
    const row = Math.max(0, Math.min(9, Math.floor(cell.gridY / 10)))
    return {
      x: (col + 0.5) * cellW,
      y: (row + 0.5) * cellH,
      value: cell.value,
    }
  })
}

function drawScrollOverlay(
  canvas: HTMLCanvasElement,
  width: number,
  height: number,
  buckets: HeatmapScrollBucket[],
  opacity: number
) {
  const dpr = window.devicePixelRatio || 1
  canvas.width = Math.floor(width * dpr)
  canvas.height = Math.floor(height * dpr)
  canvas.style.width = `${width}px`
  canvas.style.height = `${height}px`
  const ctx = canvas.getContext("2d")
  if (!ctx) return
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
  ctx.clearRect(0, 0, width, height)

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
    grad.addColorStop(
      r / 10,
      rgbaScroll(reach, opacity * (0.15 + 0.55 * reach))
    )
  }
  ctx.fillStyle = grad
  ctx.fillRect(0, 0, width, height)
}

function toPaintPoints(points: HeatmapPoint[]) {
  return points.map((p, i) => ({
    id: `p${i}`,
    px: p.x,
    py: p.y,
    ex: p.ex ?? null,
    ey: p.ey ?? null,
    selector: p.selector ?? null,
    value: p.value,
  }))
}

function previewStepSlugFromSrc(src: string | null | undefined): string | null {
  if (!src) return null
  try {
    const u = new URL(src)
    const hm = u.searchParams.get("_hm")?.trim()
    if (hm && hm !== "start") return hm
    const hash = u.hash.replace(/^#\/?/, "").trim()
    return hash || null
  } catch {
    return null
  }
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
  previewSrc = null,
}: HeatmapCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const iframeRef = useRef<HTMLIFrameElement>(null)
  const requestIdRef = useRef(0)
  const paintTargetRef = useRef<PaintTarget>("unknown")
  const latestHeightRef = useRef(0)
  const measuringRef = useRef(true)
  const settledHeightRef = useRef<number | null>(null)
  const settleTimerRef = useRef(0)
  const stepAppliedRef = useRef(false)

  const frameWidth = DEVICE_WIDTH[device]
  const viewportHeight = Math.round(
    frameWidth * (device === "mobile" ? 1.9 : device === "tablet" ? 1.25 : 0.62)
  )

  const iframeSrc = previewSrc || backgroundUrl || null
  const targetStepSlug = previewStepSlugFromSrc(iframeSrc)
  const [pageLoaded, setPageLoaded] = useState(false)
  const [pageFailed, setPageFailed] = useState(false)
  const [paintTarget, setPaintTarget] = useState<PaintTarget>("unknown")
  const [measuring, setMeasuring] = useState(true)
  const [contentHeight, setContentHeight] = useState<number | null>(null)
  const [viewKey, setViewKey] = useState(`${iframeSrc ?? ""}:${device}`)
  const nextViewKey = `${iframeSrc ?? ""}:${device}`
  if (viewKey !== nextViewKey) {
    setViewKey(nextViewKey)
    setPageLoaded(false)
    setPageFailed(false)
    setMeasuring(true)
    setContentHeight(null)
    setPaintTarget("unknown")
    settledHeightRef.current = null
    latestHeightRef.current = 0
    stepAppliedRef.current = !targetStepSlug
  }

  const hasLivePage = Boolean(iframeSrc && !backgroundImage)
  const fallbackPageHeight = Math.round(frameWidth * PAGE_HEIGHT_RATIO[device])
  const pageHeight = hasLivePage
    ? Math.max(viewportHeight, contentHeight ?? viewportHeight)
    : backgroundImage
      ? fallbackPageHeight
      : fallbackPageHeight

  const iframeHeight = hasLivePage
    ? measuring
      ? viewportHeight
      : pageHeight
    : pageHeight

  const useInPageOverlay =
    hasLivePage &&
    pageLoaded &&
    !pageFailed &&
    !emptyState &&
    !measuring &&
    mode !== "scroll" &&
    paintTarget !== "parent"

  useEffect(() => {
    paintTargetRef.current = paintTarget
  }, [paintTarget])

  useEffect(() => {
    measuringRef.current = measuring
  }, [measuring])

  useEffect(() => {
    paintTargetRef.current = "unknown"
    latestHeightRef.current = 0
    measuringRef.current = true
    settledHeightRef.current = null
    stepAppliedRef.current = !targetStepSlug
  }, [targetStepSlug, viewKey])

  const clampHeight = useCallback(
    (raw: number) =>
      Math.max(
        Math.round(frameWidth * 0.5),
        Math.min(Math.round(frameWidth * 30), Math.round(raw))
      ),
    [frameWidth]
  )

  const armSettle = useCallback((delay: number) => {
    window.clearTimeout(settleTimerRef.current)
    settleTimerRef.current = window.setTimeout(() => {
      settledHeightRef.current = latestHeightRef.current || null
      measuringRef.current = false
      setMeasuring(false)
    }, delay)
  }, [])

  useEffect(() => {
    if (!hasLivePage || !pageLoaded) return
    armSettle(2600)
    const grace = window.setTimeout(() => {
      stepAppliedRef.current = true
    }, 1500)
    return () => {
      window.clearTimeout(grace)
      window.clearTimeout(settleTimerRef.current)
    }
  }, [armSettle, hasLivePage, pageLoaded, viewKey])

  useEffect(() => {
    if (!hasLivePage) return
    const onMessage = (event: MessageEvent) => {
      if (event.source !== iframeRef.current?.contentWindow) return
      const data = event.data as
        | {
            source?: string
            type?: string
            height?: number
            slug?: string
            features?: string[]
            requestId?: number
          }
        | undefined
      if (!data || data.source !== MESSAGE_SOURCE) return

      if (data.type === "heatmap-step-shown") {
        if (targetStepSlug && data.slug && data.slug !== targetStepSlug) return
        stepAppliedRef.current = true
        latestHeightRef.current = 0
        settledHeightRef.current = null
        measuringRef.current = true
        setMeasuring(true)
        const height = Number(data.height)
        if (Number.isFinite(height) && height > 0) {
          const clamped = clampHeight(height)
          latestHeightRef.current = clamped
          setContentHeight(clamped)
        }
        armSettle(700)
        return
      }

      if (data.type === "doc-size") {
        const features = Array.isArray(data.features) ? data.features : []
        if (features.includes("heatmap-paint")) {
          setPaintTarget((prev) => (prev === "parent" ? prev : "inpage"))
        }

        if (!measuringRef.current) return
        if (targetStepSlug && !stepAppliedRef.current) return

        const height = Number(data.height)
        if (!Number.isFinite(height) || height <= 0) return
        const clamped = clampHeight(height)
        if (clamped === latestHeightRef.current) return
        latestHeightRef.current = clamped
        setContentHeight(clamped)
        armSettle(700)
        return
      }

      if (data.type === "heatmap-painted") {
        if (data.requestId !== requestIdRef.current) return
        setPaintTarget((prev) => (prev === "parent" ? prev : "inpage"))
      }
    }
    window.addEventListener("message", onMessage)
    return () => window.removeEventListener("message", onMessage)
  }, [armSettle, clampHeight, hasLivePage, targetStepSlug])

  useEffect(() => {
    if (!hasLivePage || !pageLoaded || !measuring) return
    const win = iframeRef.current?.contentWindow
    if (!win) return
    const ping = () => {
      if (targetStepSlug) {
        win.postMessage(
          {
            source: MESSAGE_SOURCE,
            type: "heatmap-show-step",
            slug: targetStepSlug,
          },
          "*"
        )
      }
      win.postMessage({ source: MESSAGE_SOURCE, type: "ping" }, "*")
    }
    ping()
    const interval = window.setInterval(ping, 300)
    return () => window.clearInterval(interval)
  }, [hasLivePage, measuring, pageLoaded, device, targetStepSlug])

  useEffect(() => {
    if (!hasLivePage) return
    const win = iframeRef.current?.contentWindow
    if (!win) return
    if (emptyState || mode === "scroll" || paintTarget === "parent") {
      win.postMessage({ source: MESSAGE_SOURCE, type: "heatmap-clear" }, "*")
    }
  }, [emptyState, hasLivePage, mode, paintTarget, iframeSrc])

  useEffect(() => {
    if (!useInPageOverlay) return
    const win = iframeRef.current?.contentWindow
    if (!win) return

    const requestId = ++requestIdRef.current
    const payloadPoints = toPaintPoints(points)

    win.postMessage(
      {
        source: MESSAGE_SOURCE,
        type: "heatmap-paint",
        requestId,
        points: payloadPoints,
        maxValue: Math.max(1, maxValue),
        opacity,
        mode: mode === "attention" ? "attention" : "click",
      },
      "*"
    )

    const timer = window.setTimeout(() => {
      setPaintTarget((prev) => (prev === "unknown" ? "parent" : prev))
    }, 1200)

    return () => window.clearTimeout(timer)
  }, [useInPageOverlay, points, maxValue, opacity, mode, iframeSrc, device])

  useEffect(() => {
    if (emptyState) return
    const canvas = canvasRef.current
    if (!canvas) return

    const shouldPaintParent =
      !hasLivePage ||
      mode === "scroll" ||
      paintTarget === "parent" ||
      Boolean(backgroundImage)

    if (!shouldPaintParent) {
      const ctx = canvas.getContext("2d")
      if (ctx) {
        canvas.width = 1
        canvas.height = 1
        ctx.clearRect(0, 0, 1, 1)
      }
      canvas.style.width = "0px"
      canvas.style.height = "0px"
      return
    }

    if (mode === "scroll") {
      drawScrollOverlay(canvas, frameWidth, pageHeight, scrollBuckets, opacity)
      return
    }

    const densityPoints =
      points.length > 0
        ? points.map((p) => ({
            x: p.x * frameWidth,
            y: p.y * pageHeight,
            value: p.value,
          }))
        : cellsToPoints(cells, frameWidth, pageHeight)

    const radius =
      mode === "attention"
        ? Math.max(22, Math.round(frameWidth * 0.022))
        : Math.max(16, Math.round(frameWidth * 0.015))

    const paintHeat = (target: HTMLCanvasElement) => {
      paintDensityHeatmap(target, densityPoints, {
        width: frameWidth,
        height: pageHeight,
        maxValue: Math.max(1, maxValue),
        opacity,
        radius,
      })
    }

    if (backgroundImage) {
      const img = new Image()
      img.onload = () => {
        const dpr = window.devicePixelRatio || 1
        canvas.width = Math.floor(frameWidth * dpr)
        canvas.height = Math.floor(pageHeight * dpr)
        canvas.style.width = `${frameWidth}px`
        canvas.style.height = `${pageHeight}px`
        const ctx = canvas.getContext("2d")
        if (!ctx) return
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
        ctx.clearRect(0, 0, frameWidth, pageHeight)
        ctx.drawImage(img, 0, 0, frameWidth, pageHeight)
        const heat = document.createElement("canvas")
        paintHeat(heat)
        ctx.drawImage(heat, 0, 0, frameWidth, pageHeight)
      }
      img.src = backgroundImage
      return
    }

    if (!hasLivePage) {
      const dpr = window.devicePixelRatio || 1
      canvas.width = Math.floor(frameWidth * dpr)
      canvas.height = Math.floor(pageHeight * dpr)
      canvas.style.width = `${frameWidth}px`
      canvas.style.height = `${pageHeight}px`
      const ctx = canvas.getContext("2d")
      if (ctx) {
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
        ctx.clearRect(0, 0, frameWidth, pageHeight)
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
        const heat = document.createElement("canvas")
        paintHeat(heat)
        ctx.drawImage(heat, 0, 0, frameWidth, pageHeight)
      }
      return
    }

    paintHeat(canvas)
  }, [
    backgroundImage,
    cells,
    emptyState,
    frameWidth,
    hasLivePage,
    maxValue,
    mode,
    opacity,
    pageHeight,
    paintTarget,
    points,
    scrollBuckets,
  ])

  const showParentCanvas =
    !emptyState &&
    (mode === "scroll" ||
      paintTarget === "parent" ||
      Boolean(backgroundImage) ||
      !hasLivePage)

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
        scrollResetKey={viewKey}
      >
        <div
          className={cn(
            "relative block",
            hasLivePage || backgroundImage ? "bg-transparent" : "bg-white"
          )}
          style={{ width: frameWidth, height: pageHeight }}
        >
          {hasLivePage ? (
            <iframe
              key={viewKey}
              ref={iframeRef}
              src={iframeSrc ?? undefined}
              title="Landing page preview"
              className="pointer-events-none absolute inset-x-0 top-0 z-0 block border-0"
              style={{
                width: frameWidth,
                height: iframeHeight,
              }}
              sandbox="allow-scripts allow-same-origin"
              loading="eager"
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
            <div
              className="pointer-events-none absolute inset-0 z-10 bg-neutral-50/90 p-6"
              aria-busy
              aria-label="Loading page preview"
            >
              <div className="flex h-full flex-col gap-4">
                <div className="h-8 w-2/3 max-w-md animate-pulse rounded-md bg-neutral-200" />
                <div className="h-4 w-1/2 max-w-sm animate-pulse rounded-md bg-neutral-200" />
                <div className="mt-4 h-40 w-full max-w-lg animate-pulse rounded-md bg-neutral-200" />
                <div className="h-10 w-36 animate-pulse rounded-md bg-neutral-200" />
              </div>
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
              className={cn(
                "pointer-events-none absolute top-0 left-0 z-20",
                !showParentCanvas && "invisible"
              )}
            />
          )}
        </div>
      </HeatmapDeviceFrame>
    </div>
  )
}
