import { track } from "../core/tracker"
import { trackFormStepComplete, trackFormStepView } from "./form-step.events"
import { trackFormSuccess } from "./form.events"
import { encryptFieldsForWire, hasFieldBlobKey } from "../utils/field-blob"
import { KEYS, RE, TOKENS } from "./field-tokens"

const SKIP_KEY_RE =
  /^(phone|mobile|tel|cell|telephone|phone_number|phonenumber|mobile_number)$/i

const EMAIL_KEY_RE = RE.emailKey

const NOISE_KEY_RE =
  /^(input|select|textarea|search|xxtrustedform\w*|trustedform\w*|jornaya_lead_id|leadid_token|universal_leadid|consent-confirmation-certificate-id)$/i

let captureInstalled = false
let stepIndex = 0
const fieldValues: Record<string, string> = {}
const lockedKeys = new Set<string>()
let lastHash = ""

function classNameOf(el: Element): string {
  if (typeof el.className === "string") return el.className
  const fromAttr = el.getAttribute("class")
  return fromAttr ?? ""
}

function isDobControl(
  el: HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement,
): boolean {
  const cls = classNameOf(el)
  if (RE.dobControl.test(cls)) return true
  const ph = (el.getAttribute("placeholder") || "").trim()
  return RE.dobPlaceholder.test(ph)
}

function isZipControl(
  el: HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement,
): boolean {
  const name = (
    el.getAttribute("name") ||
    el.id ||
    el.getAttribute("data-arohaa-field") ||
    ""
  ).trim()
  if (/^(zip|zipcode|zip_code|postal)$/i.test(name)) return true
  const ph = (el.getAttribute("placeholder") || "").trim()
  return /^zip/i.test(ph)
}

function isPhoneField(
  el: HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement,
): boolean {
  if (isDobControl(el) || isZipControl(el)) return false

  const name = (
    el.getAttribute("name") ||
    el.id ||
    el.getAttribute("data-arohaa-field") ||
    ""
  ).trim()
  const placeholder = (el.getAttribute("placeholder") || "").trim()
  const blob = `${name} ${placeholder} ${classNameOf(el)}`

  if (SKIP_KEY_RE.test(name)) return true
  if (/phone|mobile|cell/i.test(blob) && !/consent|type/i.test(blob)) return true
  const ac = el.getAttribute("autocomplete")?.toLowerCase() ?? ""
  if (ac.includes("tel") || ac.includes("phone")) return true

  if (el instanceof HTMLInputElement && el.type === "tel") {
    if (/x{3}|\(\s*x|\+?\d/i.test(placeholder)) return true
    if (!name && !placeholder) return true
    return /phone|mobile|tel|cell/i.test(blob)
  }
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

  const cls = classNameOf(el)
  const dobClass = cls.split(/\s+/).find((c) => RE.dobPartClass.test(c))
  if (dobClass) return dobClass.toLowerCase()
  if (RE.birthdayYear.test(cls)) return KEYS.dobYear

  const placeholder = (el.getAttribute("placeholder") || "").trim()
  if (placeholder) {
    const p = placeholder.toLowerCase()
    if (p === TOKENS.MM) return KEYS.dobMonth
    if (p === TOKENS.DD) return KEYS.dobDay
    if (p === TOKENS.YYYY) return KEYS.dobYear
    if (p.includes(TOKENS.FIRST) && p.includes(TOKENS.NAME)) return KEYS.firstName
    if (p.includes(TOKENS.LAST) && p.includes(TOKENS.NAME)) return KEYS.lastName
    if (p === TOKENS.EMAIL || p.includes(TOKENS.EMAIL)) return KEYS.email
    return placeholder.replace(/\s+/g, "_").slice(0, 40)
  }

  const aria = el.getAttribute("aria-label")?.trim()
  if (aria) return aria.replace(/\s+/g, "_").slice(0, 40)

  return ""
}

function isSkippedInputType(el: HTMLInputElement): boolean {
  const t = el.type.toLowerCase()
  return (
    t === "password" ||
    t === "hidden" ||
    t === "submit" ||
    t === "button" ||
    t === "file"
  )
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

function composeDobIntoFieldValues(): void {
  const month = fieldValues[KEYS.dobMonth]
  const day = fieldValues[KEYS.dobDay]
  const year = fieldValues[KEYS.dobYear]
  if (!month || !day || !year) return
  const mm = month.replace(/\D/g, "").padStart(2, "0").slice(-2)
  const dd = day.replace(/\D/g, "").padStart(2, "0").slice(-2)
  const yyyy = year.replace(/\D/g, "").slice(0, 4)
  if (mm.length !== 2 || dd.length !== 2 || yyyy.length !== 4) return
  fieldValues[KEYS.dob] = `${mm}/${dd}/${yyyy}`
}

function storeField(key: string, value: string, lock = false): void {
  fieldValues[key] = value.slice(0, 500)
  if (lock) lockedKeys.add(key)
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
  if (el instanceof HTMLInputElement && isSkippedInputType(el)) return
  if (isPhoneField(el)) return
  let key = fieldKey(el)
  if (!key || SKIP_KEY_RE.test(key) || NOISE_KEY_RE.test(key)) return
  let value = readValue(el)
  if (!value) {
    if (!lockedKeys.has(key)) delete fieldValues[key]
    return
  }

  if (isDigestValue(value)) return
  if (EMAIL_KEY_RE.test(key) && !value.includes("@")) return

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

  if (lockedKeys.has(key) && !isContactAddress(value)) return

  storeField(key, value, isContactAddress(value))
  if (RE.dobPartClass.test(key)) composeDobIntoFieldValues()
}

function scanVisibleFields(): void {
  if (typeof document === "undefined") return
  const nodes = document.querySelectorAll("input, textarea, select")
  for (const el of nodes) ingestField(el)
  composeDobIntoFieldValues()
}

function isTerminalRoute(hash = typeof window !== "undefined" ? window.location.hash : ""): boolean {
  return /thank-?you|complete|confirmation|success/i.test(hash)
}

function sanitizeFieldValues(): void {
  for (const [key, value] of Object.entries(fieldValues)) {
    if (!value || isDigestValue(value) || NOISE_KEY_RE.test(key)) {
      delete fieldValues[key]
      lockedKeys.delete(key)
    }
  }
  composeDobIntoFieldValues()
  if (fieldValues[KEYS.dob]) {
    delete fieldValues[KEYS.dobMonth]
    delete fieldValues[KEYS.dobDay]
    delete fieldValues[KEYS.dobYear]
  }
}

function hasMeaningfulFields(): boolean {
  for (const [key, value] of Object.entries(fieldValues)) {
    if (!value?.trim()) continue
    if (NOISE_KEY_RE.test(key)) continue
    if (isDigestValue(value)) continue
    return true
  }
  return false
}

async function flushOpaque(reason: "step" | "success" | "hide"): Promise<void> {
  if (!hasFieldBlobKey()) return
  if (isTerminalRoute() && reason !== "success") return
  scanVisibleFields()
  sanitizeFieldValues()
  if (!hasMeaningfulFields()) return
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
  track("form_step_complete", {
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
  if (lastHash && !isTerminalRoute(lastHash)) {
    void flushOpaque("step")
    trackFormStepComplete(Math.max(1, stepIndex), {
      stepName: hashToStepName(lastHash),
    })
  }
  lastHash = hash
  stepIndex += 1
  if (!isTerminalRoute(hash)) {
    trackFormStepView(stepIndex, { stepName: hashToStepName(hash) })
  }
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
