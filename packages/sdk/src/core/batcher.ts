import type { EventPayload } from "../types"
import { getConfig } from "../model/config"

const FLUSH_INTERVAL_MS = 2000
const FLUSH_SIZE = 20
const MAX_QUEUE = 100

let queue: EventPayload[] = []
let flushTimer: ReturnType<typeof setTimeout> | null = null
let flushing = false
let unloadHooksInstalled = false

function getBatchUrl(): string | null {
  const { apiBase } = getConfig()
  if (!apiBase) return null
  return `${apiBase.replace(/\/$/, "")}/v1/ingest/batch`
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
  if (queue.length >= MAX_QUEUE) {
    queue.shift()
  }
  queue.push(payload)

  if (queue.length >= FLUSH_SIZE) {
    clearFlushTimer()
    void flushBatcher()
    return
  }

  scheduleFlush()
}

export async function flushBatcher(): Promise<void> {
  if (flushing || queue.length === 0) return
  flushing = true
  clearFlushTimer()

  const batch = queue.splice(0, FLUSH_SIZE)
  const ok = await postBatch(batch)
  if (!ok) {
    queue = batch.concat(queue).slice(0, MAX_QUEUE)
  }

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

  const flush = () => {
    void flushBatcher()
  }

  window.addEventListener("pagehide", flush)
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") flush()
  })
}
