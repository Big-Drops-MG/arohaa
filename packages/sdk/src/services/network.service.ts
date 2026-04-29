import type { EventPayload } from "../types"
import { getConfig } from "../model/config"

export function sendRequest(payload: EventPayload): void {
  const { apiBase } = getConfig()

  if (!apiBase) {
    console.error("[arohaa] data-api attribute is missing on script tag")
    return
  }

  const url = `${apiBase}/v1/ingest`
  const body = JSON.stringify(payload)

  if (typeof navigator !== "undefined" && navigator.sendBeacon) {
    const blob = new Blob([body], { type: "application/json" })
    navigator.sendBeacon(url, blob)
    return
  }

  fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body,
    keepalive: true,
  }).catch(() => {})
}
