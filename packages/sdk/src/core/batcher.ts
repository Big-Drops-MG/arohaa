import type { EventPayload } from "../types"
import { getConfig } from "../model/config"

const FLUSH_INTERVAL_MS = 2000
const FLUSH_SIZE = 50
const MAX_QUEUE = 100
const STORAGE_KEY = "aro_hm_batch"

let queue: EventPayload[] = []
let flushTimer: ReturnType<typeof setTimeout> | null = null
let flushing = false
let unloadHooksInstalled = false
let restored = false

function getBatchUrl(): string | null {
  const { apiBase } = getConfig()
  if (!apiBase) return null
  return `${apiBase.replace(/\/$/, "")}/v1/ingest/batch`
}

function isPersistedPayload(value: unknown): value is EventPayload {
  if (!value || typeof value !== "object") return false
  const row = value as Record<string, unknown>
  return (
    typeof row.ev === "string" &&
    row.ev.startsWith("heatmap_") &&
    typeof row.wid === "string" &&
    typeof row.uid === "string" &&
    typeof row.sid === "string"
  )
}

function persistQueue(): void {
  if (typeof sessionStorage === "undefined") return
  try {
    if (queue.length === 0) {
      sessionStorage.removeItem(STORAGE_KEY)
      return
    }
    sessionStorage.setItem(
      STORAGE_KEY,
      JSON.stringify(queue.slice(0, MAX_QUEUE)),
    )
  } catch {
    /* quota / private mode */
  }
}

function restoreQueue(): void {
  if (restored || typeof sessionStorage === "undefined") return
  restored = true
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY)
    if (!raw) return
    const parsed = JSON.parse(raw) as unknown
    if (!Array.isArray(parsed)) {
      sessionStorage.removeItem(STORAGE_KEY)
      return
    }
    const valid = parsed.filter(isPersistedPayload).slice(0, MAX_QUEUE)
    if (valid.length > 0) {
      queue = valid.concat(queue).slice(0, MAX_QUEUE)
    }
    sessionStorage.removeItem(STORAGE_KEY)
  } catch {
    try {
      sessionStorage.removeItem(STORAGE_KEY)
    } catch {
      /* ignore */
    }
  }
}

function scheduleFlush(): void {
  if (flushTimer != null) return
  flushTimer = setTimeout(() => {
    flushTimer = null
    void flushBatcher()
  }, FLUSH_INTERVAL_MS)
}

function clearFlushTimer(): void {
  if (flushTimer == null) return
  clearTimeout(flushTimer)
  flushTimer = null
}

async function postBatch(events: EventPayload[]): Promise<boolean> {
  const url = getBatchUrl()
  if (!url || events.length === 0) return true

  const body = JSON.stringify({ events })

  if (
    typeof document !== "undefined" &&
    document.visibilityState === "hidden" &&
    typeof navigator !== "undefined" &&
    navigator.sendBeacon
  ) {
    const blob = new Blob([body], { type: "application/json" })
    return navigator.sendBeacon(url, blob)
  }

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body,
      keepalive: true,
    })
    return res.ok || res.status === 202
  } catch {
    return false
  }
}

export function enqueueHeatmapEvent(payload: EventPayload): void {
  restoreQueue()

  if (queue.length >= MAX_QUEUE) {
    clearFlushTimer()
    void flushBatcher()
    if (queue.length >= MAX_QUEUE) return
  }

  queue.push(payload)
  persistQueue()

  if (queue.length >= FLUSH_SIZE) {
    clearFlushTimer()
    void flushBatcher()
    return
  }

  scheduleFlush()
}

export async function flushBatcher(): Promise<void> {
  restoreQueue()
  if (flushing || queue.length === 0) return
  flushing = true
  clearFlushTimer()

  const batch = queue.splice(0, FLUSH_SIZE)
  persistQueue()
  const ok = await postBatch(batch)
  if (!ok) {
    const merged = batch.concat(queue)
    queue = merged.length <= MAX_QUEUE ? merged : merged.slice(0, MAX_QUEUE)
  }
  persistQueue()

  flushing = false

  if (queue.length >= FLUSH_SIZE) {
    void flushBatcher()
  } else if (queue.length > 0) {
    scheduleFlush()
  }
}

export function setupBatcherUnloadHooks(): void {
  if (unloadHooksInstalled) return
  unloadHooksInstalled = true

  restoreQueue()
  if (queue.length > 0) {
    scheduleFlush()
  }

  const flush = () => {
    persistQueue()
    void flushBatcher()
  }

  window.addEventListener("pagehide", flush)
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") flush()
  })
}
