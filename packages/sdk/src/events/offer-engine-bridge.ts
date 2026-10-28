import {
  trackFormStart,
  trackFormSubmit,
  trackFormSuccess,
} from "./form.events"
import { markFormSessionSucceeded } from "./form-field-tracking"

const OE_ORIGIN = "https://forms.offer-engine.com"
const FORM_ID = "offer-engine"

let installed = false
let started = false
let succeeded = false

function messageType(data: unknown): string {
  if (!data || typeof data !== "object") return ""
  const type = (data as { type?: unknown }).type
  return typeof type === "string" ? type : ""
}

export function setupOfferEngineBridge(): void {
  if (installed || typeof window === "undefined") return
  installed = true

  window.addEventListener("message", (event) => {
    if (event.origin !== OE_ORIGIN) return

    const type = messageType(event.data)
    if (!type) return

    if (type.startsWith("fill_") && !started) {
      started = true
      trackFormStart(FORM_ID)
      return
    }

    if (type === "redirect" && !succeeded) {
      succeeded = true
      if (!started) {
        started = true
        trackFormStart(FORM_ID)
      }
      trackFormSubmit(FORM_ID)
      trackFormSuccess(FORM_ID)
      markFormSessionSucceeded(FORM_ID)
    }
  })
}
