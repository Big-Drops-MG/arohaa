import type { EventPayload } from "../types"
import { getItem, setItem } from "../services/storage.service"

const OUTBOX_KEY = "arohaa_outbox"
const MAX_OUTBOX_SIZE = 50
const MAX_ATTEMPTS = 3
const MAX_AGE_MS = 24 * 60 * 60 * 1000
const DRAIN_BATCH_SIZE = 10

export type SendOutcome = "ok" | "transient" | "permanent"

export type SendFunction = (payload: EventPayload) => Promise<SendOutcome>

interface OutboxEntry {
  payload: EventPayload
  savedAt: number
  attempts: number
}

let drainInFlight = false

function readOutbox(): OutboxEntry[] {
  const raw = getItem(OUTBOX_KEY)
  if (!raw) return []
  try {
    const parsed = JSON.parse(raw) as unknown
    if (!Array.isArray(parsed)) return []
    return parsed.filter(isValidEntry)
  } catch {
    return []
  }
}

function isValidEntry(value: unknown): value is OutboxEntry {
  if (!value || typeof value !== "object") return false
  const v = value as Record<string, unknown>
  return (
    typeof v.savedAt === "number" &&
    typeof v.attempts === "number" &&
    v.payload !== null &&
    typeof v.payload === "object"
  )
}

function writeOutbox(entries: OutboxEntry[]): void {
  if (entries.length === 0) {
    setItem(OUTBOX_KEY, "[]")
    return
  }
  setItem(OUTBOX_KEY, JSON.stringify(entries))
}

function pruneExpired(entries: OutboxEntry[], now: number): OutboxEntry[] {
  return entries.filter((e) => now - e.savedAt < MAX_AGE_MS)
}

export function saveToOutbox(payload: EventPayload): void {
  const now = Date.now()
  const current = pruneExpired(readOutbox(), now)

  const next: OutboxEntry[] = current.length >= MAX_OUTBOX_SIZE
    ? current.slice(current.length - MAX_OUTBOX_SIZE + 1)
    : current

  next.push({ payload, savedAt: now, attempts: 0 })
  writeOutbox(next)
}

export function getOutboxSize(): number {
  return pruneExpired(readOutbox(), Date.now()).length
}

export async function drainOutbox(send: SendFunction): Promise<{
  attempted: number
  delivered: number
  dropped: number
  remaining: number
}> {
  if (drainInFlight) {
    return { attempted: 0, delivered: 0, dropped: 0, remaining: getOutboxSize() }
  }

  if (typeof navigator !== "undefined" && navigator.onLine === false) {
    return { attempted: 0, delivered: 0, dropped: 0, remaining: getOutboxSize() }
  }

  drainInFlight = true
  try {
    const now = Date.now()
    let queue = pruneExpired(readOutbox(), now)
    if (queue.length === 0) {
      return { attempted: 0, delivered: 0, dropped: 0, remaining: 0 }
    }

    const batch = queue.slice(0, DRAIN_BATCH_SIZE)
    const tail = queue.slice(DRAIN_BATCH_SIZE)

    let attempted = 0
    let delivered = 0
    let dropped = 0
    const requeued: OutboxEntry[] = []

    for (const entry of batch) {
      attempted++
      let outcome: SendOutcome
      try {
        outcome = await send(entry.payload)
      } catch {
        outcome = "transient"
      }

      if (outcome === "ok") {
        delivered++
        continue
      }
      if (outcome === "permanent") {
        dropped++
        continue
      }

      const nextAttempts = entry.attempts + 1
      if (nextAttempts >= MAX_ATTEMPTS) {
        dropped++
        continue
      }
      requeued.push({ ...entry, attempts: nextAttempts })
    }

    queue = requeued.concat(tail)
    writeOutbox(queue)

    return { attempted, delivered, dropped, remaining: queue.length }
  } finally {
    drainInFlight = false
  }
}

export function setupOutboxDrainTriggers(send: SendFunction): void {
  if (typeof window === "undefined") return

  const trigger = () => {
    void drainOutbox(send)
  }

  window.addEventListener("online", trigger)
  window.addEventListener("load", trigger)
  if (typeof document !== "undefined") {
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "visible") trigger()
    })
  }
}

export const __retryInternals = {
  OUTBOX_KEY,
  MAX_OUTBOX_SIZE,
  MAX_ATTEMPTS,
  MAX_AGE_MS,
  DRAIN_BATCH_SIZE,
}
