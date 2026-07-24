import { track } from "../core/tracker"
import { getHeatmapSampleRate } from "../core/sdk-config"
import { getPageNorm } from "../utils/helpers"
import { getStableSelector } from "../utils/selector"

type DeviceType = "mobile" | "tablet" | "desktop"

const MOVE_MAX_KEEP = 0.25
const MOVE_THROTTLE_MS = 500
const MIN_DWELL_MS = 250
const MAX_SECTIONS = 40
const SECTION_SELECTOR =
  "main, section, [data-arohaa-section], [data-section]"

type OpenSection = {
  enteredAt: number
  selector: string
}

const openSections = new Map<Element, OpenSection>()
let lastMoveAt = 0
let attentionSetup = false

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

function hasFinePointer(): boolean {
  try {
    return window.matchMedia("(pointer: fine)").matches
  } catch {
    return true
  }
}

function emitSectionDwell(el: Element, endedAt: number): void {
  const open = openSections.get(el)
  if (!open) return
  openSections.delete(el)

  const dwell_ms = Math.max(0, endedAt - open.enteredAt)
  if (dwell_ms < MIN_DWELL_MS) return

  track("heatmap_section", {
    selector: open.selector,
    dwell_ms,
  })
}

function flushOpenSections(): void {
  const now = Date.now()
  for (const el of Array.from(openSections.keys())) {
    emitSectionDwell(el, now)
  }
}

function setupMousemoveSampling(): void {
  if (!hasFinePointer()) return

  window.addEventListener(
    "mousemove",
    (e) => {
      if (document.visibilityState === "hidden") return
      const now = Date.now()
      if (now - lastMoveAt < MOVE_THROTTLE_MS) return
      lastMoveAt = now


      const keep = Math.min(getHeatmapSampleRate(), MOVE_MAX_KEEP)
      if (Math.random() >= keep) return

      const vw = window.innerWidth || 1
      const vh = window.innerHeight || 1
      const { px, py } = getPageNorm(e.clientX, e.clientY)
      track("heatmap_move", {
        vx: clamp01(e.clientX / vw),
        vy: clamp01(e.clientY / vh),
        px,
        py,
        vw: window.innerWidth,
        vh: window.innerHeight,
        device: resolveDevice(),
      })
    },
    { passive: true },
  )
}

function setupSectionObserver(): void {
  if (typeof IntersectionObserver === "undefined") return

  const observer = new IntersectionObserver(
    (entries) => {
      const now = Date.now()
      for (const entry of entries) {
        const el = entry.target
        if (entry.isIntersecting) {
          if (!openSections.has(el)) {
            openSections.set(el, {
              enteredAt: now,
              selector: getStableSelector(el),
            })
          }
        } else {
          emitSectionDwell(el, now)
        }
      }
    },
    { threshold: [0, 0.25, 0.5, 0.75, 1] },
  )

  const nodes = Array.from(document.querySelectorAll(SECTION_SELECTOR)).slice(
    0,
    MAX_SECTIONS,
  )
  for (const el of nodes) observer.observe(el)

  window.addEventListener("pagehide", flushOpenSections)
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") flushOpenSections()
  })
}

export function setupAttentionTracking(): void {
  if (attentionSetup) return
  attentionSetup = true
  setupMousemoveSampling()
  setupSectionObserver()
}
