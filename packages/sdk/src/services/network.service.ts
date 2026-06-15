import type { EventPayload } from "../types"
import { getConfig } from "../model/config"
import { saveToOutbox, type SendOutcome } from "../network/retry"

const CONVERSION_EVENTS = new Set([
  "form_success",
  "form_submit",
  "zip_submit",
  "call_click",
])

function getIngestUrl(): string | null {
  const { apiBase } = getConfig()
  if (!apiBase) {
    console.error("[arohaa] data-api attribute is missing on script tag")
    return null
  }
  return `${apiBase}/v1/ingest`
}

function isPageHidden(): boolean {
  return (
    typeof document !== "undefined" && document.visibilityState === "hidden"
  )
}

function preferBeacon(payload: EventPayload): boolean {
  return isPageHidden() || CONVERSION_EVENTS.has(payload.ev)
}

export async function attemptSend(payload: EventPayload): Promise<SendOutcome> {
  const url = getIngestUrl()
  if (!url) return "permanent"

  const body = JSON.stringify(payload)

  if (
    preferBeacon(payload) &&
    typeof navigator !== "undefined" &&
    navigator.sendBeacon
  ) {
    const blob = new Blob([body], { type: "application/json" })
    if (navigator.sendBeacon(url, blob)) return "ok"
  }

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body,
      keepalive: true,
    })
    if (res.ok) return "ok"
    if (res.status === 408 || res.status === 429) return "transient"
    if (res.status >= 400 && res.status < 500) return "permanent"
    return "transient"
  } catch {
    return "transient"
  }
}

export function sendRequest(payload: EventPayload): void {
  void (async () => {
    const outcome = await attemptSend(payload)
    if (outcome === "transient") {
      saveToOutbox(payload)
    }
  })()
}
