import type { EventPayload } from "../types"

const INGEST_URL = "https://analytics.arohaa.com/v1/ingest"

export function sendRequest(payload: EventPayload): void {
  const body = JSON.stringify(payload)

  if (typeof navigator !== "undefined" && navigator.sendBeacon) {
    navigator.sendBeacon(INGEST_URL, body)
    return
  }

  fetch(INGEST_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body,
    keepalive: true,
  }).catch(() => {
    // silently fail -- analytics should never break host page
  })
}
