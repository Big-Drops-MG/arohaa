"use client"

import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
} from "react"
import { cn } from "@workspace/ui/lib/utils"
import type { HeatmapDevice } from "@/features/heatmap/model/heatmap"

type HeatmapDeviceFrameProps = {
  device: HeatmapDevice
  children: ReactNode
  className?: string
  screenHeight: number
  screenWidth: number
}

function frameKind(device: HeatmapDevice): "laptop" | "tablet" | "mobile" {
  if (device === "mobile") return "mobile"
  if (device === "tablet") return "tablet"
  return "laptop"
}

export function HeatmapDeviceFrame({
  device,
  children,
  className,
  screenHeight,
  screenWidth,
}: HeatmapDeviceFrameProps) {
  const kind = frameKind(device)
  const lidWidth = Math.min(screenWidth + 32, 1040)
  const mobileWidth = Math.min(screenWidth + 20, 430)
  const tabletWidth = Math.min(screenWidth + 24, 820)
  const outerWidth =
    kind === "laptop"
      ? lidWidth * 1.12
      : kind === "mobile"
        ? mobileWidth
        : tabletWidth

  const containerRef = useRef<HTMLDivElement>(null)
  const innerRef = useRef<HTMLDivElement>(null)
  const [scale, setScale] = useState(1)
  const [naturalHeight, setNaturalHeight] = useState(screenHeight + 80)

  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const update = () => {
      const available = el.clientWidth
      if (available <= 0) return
      setScale(Math.min(1, available / outerWidth))
    }
    update()
    const observer = new ResizeObserver(update)
    observer.observe(el)
    return () => observer.disconnect()
  }, [outerWidth])

  useLayoutEffect(() => {
    const el = innerRef.current
    if (!el) return
    setNaturalHeight(el.offsetHeight)
  }, [device, screenHeight, screenWidth, scale])

  const screen = (
    <div
      className="overflow-hidden bg-white"
      style={{
        height: screenHeight,
        borderRadius:
          kind === "mobile"
            ? "1.7rem"
            : kind === "tablet"
              ? "1.15rem"
              : "0.375rem",
      }}
    >
      <div className="h-full overflow-auto overscroll-contain">{children}</div>
    </div>
  )

  let deviceNode: ReactNode
  if (kind === "mobile") {
    deviceNode = (
      <div
        className="relative rounded-[2.25rem] bg-neutral-900 p-[10px] shadow-[0_20px_50px_-20px_rgba(0,0,0,0.45)] ring-1 ring-black/40"
        style={{ width: mobileWidth }}
      >
        {screen}
        <div className="pointer-events-none absolute inset-y-16 -left-[2px] w-[3px] rounded-l-sm bg-neutral-700" />
        <div className="pointer-events-none absolute top-28 -right-[2px] h-12 w-[3px] rounded-r-sm bg-neutral-700" />
        <div className="pointer-events-none absolute top-44 -right-[2px] h-12 w-[3px] rounded-r-sm bg-neutral-700" />
      </div>
    )
  } else if (kind === "tablet") {
    deviceNode = (
      <div
        className="relative rounded-[1.75rem] bg-neutral-800 p-3 shadow-[0_24px_60px_-24px_rgba(0,0,0,0.4)] ring-1 ring-black/30"
        style={{ width: tabletWidth }}
      >
        <div className="absolute top-1.5 left-1/2 z-30 size-2 -translate-x-1/2 rounded-full bg-neutral-950/80" />
        <div className="ring-1 ring-black/10">{screen}</div>
        <div className="mx-auto mt-2.5 size-2.5 rounded-full bg-neutral-950/70" />
      </div>
    )
  } else {
    deviceNode = (
      <div className="flex flex-col items-center">
        <div
          className="relative rounded-t-xl bg-neutral-800 px-3 pt-3 pb-2 shadow-[0_18px_40px_-18px_rgba(0,0,0,0.45)] ring-1 ring-black/25"
          style={{ width: lidWidth }}
        >
          <div className="absolute top-1.5 left-1/2 size-1.5 -translate-x-1/2 rounded-full bg-neutral-950/70" />
          <div className="ring-1 ring-black/10">{screen}</div>
        </div>
        <div
          className="relative h-3 rounded-b-md bg-neutral-700"
          style={{ width: lidWidth * 1.06 }}
        >
          <div className="absolute inset-x-[18%] top-0 h-1.5 rounded-b-sm bg-neutral-600/80" />
        </div>
        <div
          className="h-1.5 rounded-b-xl bg-neutral-500/80"
          style={{ width: lidWidth * 1.12 }}
        />
      </div>
    )
  }

  return (
    <div ref={containerRef} className={cn("w-full px-2 py-4", className)}>
      <div
        className="relative mx-auto overflow-hidden"
        style={{ height: naturalHeight * scale, width: "100%" }}
      >
        <div
          ref={innerRef}
          className="absolute top-0 left-1/2"
          style={{
            width: outerWidth,
            transform: `translateX(-50%) scale(${scale})`,
            transformOrigin: "top center",
          }}
        >
          <div className="flex justify-center">{deviceNode}</div>
        </div>
      </div>
    </div>
  )
}
