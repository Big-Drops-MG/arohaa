import { track } from "../core/tracker"
import { trackFormStepComplete, trackFormStepView } from "./form-step.events"
import { trackFormSuccess } from "./form.events"
import { encryptFieldsForWire, hasFieldBlobKey } from "../utils/field-blob"

const PHONE_KEY_RE =
  /^(phone|mobile|tel|cell|telephone|phone_number|phonenumber|mobile_number)$/i

let captureInstalled = false
let stepIndex = 0
const fieldValues: Record<string, string> = {}
let lastHash = ""

function isPhoneField(el: HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement): boolean {
  if (el instanceof HTMLInputElement && el.type === "tel") return true
  const name = (el.getAttribute("name") || el.id || el.getAttribute("data-arohaa-field") || "").trim()
  if (PHONE_KEY_RE.test(name)) return true
  if (/phone|mobile|cell/i.test(name) && !/consent|type/i.test(name)) return true
  const ac = el.getAttribute("autocomplete")?.toLowerCase() ?? ""
  if (ac.includes("tel") || ac.includes("phone")) return true
  return false
}

function fieldKey(el: HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement): string {
  const explicit = el.getAttribute("data-arohaa-field")?.trim()
  if (explicit) return explicit
  const name = el.getAttribute("name")?.trim()
  if (name) return name
  const id = el.id?.trim()
  if (id) return id
  return el.tagName.toLowerCase()
}

function readValue(el: HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement): string {
  if (el instanceof HTMLInputElement && (el.type === "checkbox" || el.type === "radio")) {
    return el.checked ? el.value || "true" : ""
  }
  return (el.value ?? "").trim()
}

function looksLikeSha256Hex(value: string): boolean {
  return /^[a-f0-9]{64}$/i.test(value)
}

function looksLikeEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)
}

function isEmailField(
  el: HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement,
  key: string,
): boolean {
  if (el instanceof HTMLInputElement && el.type === "email") return true
  if (/email/i.test(key)) return true
  const ac = el.getAttribute("autocomplete")?.toLowerCase() ?? ""
  return ac.includes("email")
}

function ingestField(el: Element): void {
  if (
    !(
      el instanceof HTMLInputElement ||
      el instanceof HTMLTextAreaElement ||
      el instanceof HTMLSelectElement
    )
  ) {
    return
  }
  if (el instanceof HTMLInputElement) {
    const t = el.type.toLowerCase()
    if (t === "password" || t === "hidden" || t === "submit" || t === "button" || t === "file") {
      return
    }
  }
  if (isPhoneField(el)) return
  const key = fieldKey(el)
  if (!key || PHONE_KEY_RE.test(key)) return
  const value = readValue(el)
  if (!value) {
    delete fieldValues[key]
    return
  }

  // Keep earlier plaintext email if RapidFire later swaps in a hash.
  if (isEmailField(el, key) || looksLikeEmail(value) || looksLikeSha256Hex(value)) {
    const prev = fieldValues.email ?? fieldValues[key]
    if (looksLikeSha256Hex(value)) {
      if (prev && looksLikeEmail(prev)) return
      // Prefer not storing hashes as "email".
      return
    }
    if (looksLikeEmail(value)) {
      fieldValues.email = value.slice(0, 500)
      if (key !== "email") fieldValues[key] = value.slice(0, 500)
      return
    }
  }

  fieldValues[key] = value.slice(0, 500)
}

function scanVisibleFields(): void {
  if (typeof document === "undefined") return
  const nodes = document.querySelectorAll("input, textarea, select")
  for (const el of nodes) ingestField(el)
}

async function flushOpaque(reason: "step" | "success" | "hide"): Promise<void> {
  if (!hasFieldBlobKey()) return
  scanVisibleFields()
  const keys = Object.keys(fieldValues)
  if (keys.length === 0) return
  const wire = await encryptFieldsForWire({ ...fieldValues })
  if (!wire) return

  if (reason === "success") {
    track("form_success", wire)
    return
  }
  if (reason === "step") {
    track("form_step_complete", {
      stepIndex: Math.max(1, stepIndex),
      ...wire,
    })
    return
  }
  track("form_step_view", {
    stepIndex: Math.max(1, stepIndex),
    ...wire,
  })
}

function hashToStepName(hash: string): string {
  const clean = hash.replace(/^#\/?/, "").trim()
  if (!clean) return "start"
  return clean.slice(0, 120)
}

function onRouteMaybeChanged(): void {
  const hash = typeof window !== "undefined" ? window.location.hash : ""
  if (hash === lastHash) return
  if (lastHash) {
    void flushOpaque("step")
    trackFormStepComplete(Math.max(1, stepIndex), {
      stepName: hashToStepName(lastHash),
    })
  }
  lastHash = hash
  stepIndex += 1
  trackFormStepView(stepIndex, { stepName: hashToStepName(hash) })
}

export function setupOpaqueFieldCapture(): void {
  if (captureInstalled || typeof document === "undefined") return
  captureInstalled = true
  lastHash = window.location.hash || ""
  if (lastHash) {
    stepIndex = 1
    trackFormStepView(1, { stepName: hashToStepName(lastHash) })
  }

  document.addEventListener(
    "input",
    (e) => {
      if (e.target instanceof Element) ingestField(e.target)
    },
    true,
  )
  document.addEventListener(
    "change",
    (e) => {
      if (e.target instanceof Element) ingestField(e.target)
    },
    true,
  )
  document.addEventListener(
    "blur",
    (e) => {
      if (e.target instanceof Element) ingestField(e.target)
    },
    true,
  )

  window.addEventListener("hashchange", () => onRouteMaybeChanged())

  document.addEventListener(
    "submit",
    () => {
      void flushOpaque("success")
      trackFormSuccess()
    },
    true,
  )

  document.addEventListener(
    "visibilitychange",
    () => {
      if (document.visibilityState === "hidden") void flushOpaque("hide")
    },
    true,
  )
  window.addEventListener(
    "pagehide",
    () => {
      void flushOpaque("hide")
    },
    true,
  )
}
