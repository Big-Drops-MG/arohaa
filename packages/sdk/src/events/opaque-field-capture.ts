import { track } from "../core/tracker"
import { trackFormStepComplete, trackFormStepView } from "./form-step.events"
import { trackFormSuccess } from "./form.events"
import { encryptFieldsForWire, hasFieldBlobKey } from "../utils/field-blob"

const SKIP_KEY_RE =
  /^(phone|mobile|tel|cell|telephone|phone_number|phonenumber|mobile_number)$/i

let captureInstalled = false
let stepIndex = 0
const fieldValues: Record<string, string> = {}
const lockedKeys = new Set<string>()
let lastHash = ""

function isPhoneField(
  el: HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement,
): boolean {
  if (el instanceof HTMLInputElement && el.type === "tel") return true
  const name = (
    el.getAttribute("name") ||
    el.id ||
    el.getAttribute("data-arohaa-field") ||
    ""
  ).trim()
  if (SKIP_KEY_RE.test(name)) return true
  if (/phone|mobile|cell/i.test(name) && !/consent|type/i.test(name)) return true
  const ac = el.getAttribute("autocomplete")?.toLowerCase() ?? ""
  if (ac.includes("tel") || ac.includes("phone")) return true
  return false
}

function fieldKey(
  el: HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement,
): string {
  const explicit = el.getAttribute("data-arohaa-field")?.trim()
  if (explicit) return explicit
  const name = el.getAttribute("name")?.trim()
  if (name) return name
  const id = el.id?.trim()
  if (id) return id
  return el.tagName.toLowerCase()
}

function readValue(
  el: HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement,
): string {
  if (
    el instanceof HTMLInputElement &&
    (el.type === "checkbox" || el.type === "radio")
  ) {
    return el.checked ? el.value || "true" : ""
  }
  return (el.value ?? "").trim()
}

const PEELABLE_RADIO_BASE_RE =
  /^(?:car|driver|vehicle)_\d+_(?:year|make|model|gender|married|fault|dui|military|sr22|credit|homeowner|education|occupation|license|age)$/i

function peelRadioField(
  key: string,
  value: string,
): { key: string; value: string } | null {
  const idx = key.lastIndexOf("_")
  if (idx <= 0) return null
  const base = key.slice(0, idx)
  const option = key.slice(idx + 1)
  if (!option || !PEELABLE_RADIO_BASE_RE.test(base)) return null
  const lower = value.trim().toLowerCase()
  if (["on", "true", "1", "yes"].includes(lower)) {
    return { key: base, value: option }
  }
  if (lower === option.toLowerCase()) {
    return { key: base, value: option }
  }
  return null
}

function clearSiblingOptionKeys(base: string): void {
  for (const existing of Object.keys(fieldValues)) {
    if (existing === base) continue
    if (existing.startsWith(`${base}_`)) {
      delete fieldValues[existing]
      lockedKeys.delete(existing)
    }
  }
}

function isDigestValue(value: string): boolean {
  return /^[a-f0-9]{64}$/i.test(value)
}

function isContactAddress(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)
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
    if (
      t === "password" ||
      t === "hidden" ||
      t === "submit" ||
      t === "button" ||
      t === "file"
    ) {
      return
    }
  }
  if (isPhoneField(el)) return
  let key = fieldKey(el)
  if (!key || SKIP_KEY_RE.test(key)) return
  let value = readValue(el)
  if (!value) {
    if (!lockedKeys.has(key)) delete fieldValues[key]
    return
  }

  if (isDigestValue(value)) {
    return
  }

  const peeled = peelRadioField(key, value)
  if (peeled) {
    key = peeled.key
    value = peeled.value
    clearSiblingOptionKeys(key)
  } else if (
    el instanceof HTMLInputElement &&
    el.type === "checkbox" &&
    ["on", "true", "1", "yes"].includes(value.toLowerCase())
  ) {
    value = "Yes"
  }

  if (lockedKeys.has(key) && !isContactAddress(value)) {
    return
  }

  fieldValues[key] = value.slice(0, 500)
  if (isContactAddress(value)) lockedKeys.add(key)
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
