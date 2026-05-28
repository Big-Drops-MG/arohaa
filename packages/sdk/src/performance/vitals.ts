import { trackMetric } from "../core/tracker"

interface LayoutShiftEntry extends PerformanceEntry {
  value: number
  hadRecentInput: boolean
}

interface EventTimingEntry extends PerformanceEntry {
  interactionId?: number
}

const VITALS_EVENT = "web_vitals"

let lcpValue = 0
let clsValue = 0
let inpValue = 0
let reported = false

function safeObserve(
  type: string,
  callback: (entries: PerformanceObserverEntryList) => void,
  options: PerformanceObserverInit = {},
): PerformanceObserver | null {
  try {
    const observer = new PerformanceObserver(callback)
    observer.observe({ type, buffered: true, ...options })
    return observer
  } catch {
    return null
  }
}

function reportVital(
  name: string,
  value: number,
  acceptZero = false,
): void {
  if (!Number.isFinite(value)) return
  if (value < 0) return
  if (!acceptZero && value === 0) return
  trackMetric(VITALS_EVENT, name, value, { metric: name })
}

function flushAll(): void {
  if (reported) return
  reported = true
  reportVital("LCP", lcpValue)
  reportVital("CLS", clsValue, true)
  reportVital("INP", inpValue)
}

export function monitorWebVitals(): void {
  if (
    typeof window === "undefined" ||
    typeof PerformanceObserver === "undefined"
  ) {
    return
  }

  safeObserve("largest-contentful-paint", (entryList) => {
    const entries = entryList.getEntries()
    if (entries.length === 0) return
    const last = entries[entries.length - 1]
    if (last) lcpValue = last.startTime
  })

  safeObserve("layout-shift", (entryList) => {
    for (const entry of entryList.getEntries()) {
      const ls = entry as LayoutShiftEntry
      if (!ls.hadRecentInput) {
        clsValue += ls.value
      }
    }
  })

  safeObserve("event", (entryList) => {
    for (const entry of entryList.getEntries()) {
      const et = entry as EventTimingEntry
      if (!et.interactionId) continue
      if (entry.duration > inpValue) {
        inpValue = entry.duration
      }
    }
  }, { durationThreshold: 16 } as PerformanceObserverInit)

  const onTerminal = () => {
    if (document.visibilityState === "hidden" || reported) {
      flushAll()
    }
  }

  document.addEventListener("visibilitychange", onTerminal, { capture: true })
  window.addEventListener("pagehide", flushAll, { capture: true })
}
