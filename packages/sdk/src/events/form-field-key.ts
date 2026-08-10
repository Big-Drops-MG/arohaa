import { KEYS, RE, TOKENS } from "./field-tokens"

const NOISE_KEY_RE =
  /^(input|select|textarea|search|xxtrustedformpingurl|jornaya_lead_id|leadid_token|universal_leadid|consent-confirmation-certificate-id)$/i

const TRUSTEDFORM_KEY_RE =
  /^(xxTrustedFormCertUrl|xxTrustedFormToken|TrustedFormCertUrl)$/i

function classNameOf(el: Element): string {
  if (typeof el.className === "string") return el.className
  const fromAttr = el.getAttribute("class")
  return fromAttr ?? ""
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

export function resolveFormControl(
  target: EventTarget | null,
): HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement | null {
  if (!(target instanceof HTMLElement)) return null
  if (
    target instanceof HTMLInputElement ||
    target instanceof HTMLTextAreaElement ||
    target instanceof HTMLSelectElement
  ) {
    return target
  }
  const labeled = target.closest("label")
  if (labeled instanceof HTMLLabelElement) {
    const control = labeled.control
    if (
      control instanceof HTMLInputElement ||
      control instanceof HTMLTextAreaElement ||
      control instanceof HTMLSelectElement
    ) {
      return control
    }
  }
  return null
}

export function resolveHeatmapFieldName(target: EventTarget | null): string {
  const el = resolveFormControl(target)
  if (!el) return ""
  if (el instanceof HTMLInputElement) {
    const t = el.type.toLowerCase()
    if (
      t === "password" ||
      t === "submit" ||
      t === "button" ||
      t === "file" ||
      t === "hidden"
    ) {
      return ""
    }
  }
  const key = fieldKey(el).slice(0, 120)
  if (!key || NOISE_KEY_RE.test(key) || TRUSTEDFORM_KEY_RE.test(key)) return ""
  return key
}
