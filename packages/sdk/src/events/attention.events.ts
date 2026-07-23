import { track } from "../core/tracker"
import { getStableSelector } from "../utils/selector"

type DeviceType = "mobile" | "tablet" | "desktop"

const MOVE_THROTTLE_MS = 100
const MIN_DWELL_MS = 250
const MAX_SECTIONS = 40
const SECTION_SELECTOR =
  "main, section, [data-arohaa-section], [data-section]"

const sectionEnteredAt = new WeakMap<Element, number>()
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
  const started = sectionEnteredAt.get(el)
  if (started == null) return
  sectionEnteredAt.delete(el)

  const dwell_ms = Math.max(0, endedAt - started)
  if (dwell_ms < MIN_DWELL_MS) return

  track("heatmap_section", {
    selector: getStableSelector(el),
    dwell_ms,
  })
}

function flushOpenSections(): void {
  const now = Date.now()
  const nodes = document.querySelectorAll(SECTION_SELECTOR)
  for (const el of Array.from(nodes).slice(0, MAX_SECTIONS)) {
    if (sectionEnteredAt.has(el)) emitSectionDwell(el, now)
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

      const vw = window.innerWidth || 1
      const vh = window.innerHeight || 1
      track("heatmap_move", {
        vx: clamp01(e.clientX / vw),
        vy: clamp01(e.clientY / vh),
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
          if (!sectionEnteredAt.has(el)) sectionEnteredAt.set(el, now)
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
