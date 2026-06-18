import { getConfig } from "../model/config"

export function formIdFromForm(form: HTMLFormElement): string | undefined {
  const id = form.id?.trim()
  if (id) return id
  const name = form.getAttribute("name")?.trim()
  return name || undefined
}

export function isSubmitFormUrl(url: string): boolean {
  try {
    const path = new URL(url, window.location.origin).pathname
    return path.endsWith("/api/submit-form")
  } catch {
    return url.includes("/api/submit-form")
  }
}

export function formSubmitsToInternalApi(form: HTMLFormElement): boolean {
  const method = (form.getAttribute("method") ?? "GET").toUpperCase()
  if (method !== "POST") return false

  const action = form.getAttribute("action")?.trim()
  const url = action && action.length > 0 ? action : window.location.href
  return isSubmitFormUrl(url)
}

export function isZipFormType(): boolean {
  return getConfig().formtype === "zip"
}

export function isZipInput(el: HTMLElement): boolean {
  if (!(el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement)) {
    return false
  }

  if (el.hasAttribute("data-arohaa-zip")) return true

  const field = el.getAttribute("data-arohaa-field")?.trim().toLowerCase()
  if (field === "zip" || field === "zipcode" || field === "zip_code") {
    return true
  }

  const name = el.name?.trim().toLowerCase()
  if (name === "zip" || name === "zipcode" || name === "zip_code") {
    return true
  }

  if (el.closest('[data-slot="zip-code-input"]')) return true

  return false
}

export function isWithinZipForm(el: HTMLElement): boolean {
  if (isZipInput(el)) return true
  if (el.closest("[data-arohaa-zip-submit]")) return true
  if (el.closest("[data-arohaa-zip-form]")) return true

  const form = el.closest("form")
  if (form && form.querySelector(
    "input[data-arohaa-zip], input[data-arohaa-field='zip'], input[data-arohaa-field='zipcode'], input[name='zip'], input[name='zipCode'], [data-slot='zip-code-input'] input",
  )) {
    return true
  }

  return false
}

export function isMarkedArohaaField(el: HTMLElement): boolean {
  if (!(el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement)) {
    return false
  }
  if (el.hasAttribute("data-arohaa-field")) return true
  return isZipInput(el)
}

export function resolveMarkedFieldName(el: HTMLElement): string {
  const explicit = el.getAttribute("data-arohaa-field")?.trim()
  if (explicit) return explicit

  if (isZipInput(el)) return "zip"

  const aria = el.getAttribute("aria-label")?.trim()
  if (aria) return aria

  const id = el.id?.trim()
  if (id && typeof document !== "undefined") {
    const label = document.querySelector(`label[for="${CSS.escape(id)}"]`)
    if (label?.textContent?.trim()) return label.textContent.trim()
  }

  if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement) {
    const placeholder = el.placeholder?.trim()
    if (placeholder) return placeholder
    const name = el.name?.trim()
    if (name) return name
    if (el.id?.trim()) return el.id.trim()
    if (el.type) return el.type
  }

  return el.tagName.toLowerCase()
}

export function normalizeZipValue(raw: string): string {
  return raw.replace(/\D/g, "").slice(0, 5)
}

export function isValidZipValue(zip: string): boolean {
  return /^\d{5}$/.test(normalizeZipValue(zip))
}

export function readZipValue(container?: ParentNode | null): string | null {
  if (typeof document === "undefined") return null
  const root = container ?? document

  const marked = root.querySelector<HTMLInputElement>(
    "input[data-arohaa-zip], input[data-arohaa-field='zip'], input[data-arohaa-field='zipcode'], input[name='zip'], input[name='zipCode'], [data-slot='zip-code-input'] input",
  )
  if (marked?.value) {
    const zip = normalizeZipValue(marked.value)
    return isValidZipValue(zip) ? zip : null
  }

  return null
}

export function findZipSubmitControl(target: EventTarget | null): HTMLElement | null {
  if (!(target instanceof HTMLElement)) return null
  const explicit = target.closest("[data-arohaa-zip-submit]")
  if (explicit instanceof HTMLElement) return explicit
  return null
}

export function findZipFormRoot(el: HTMLElement): HTMLElement | null {
  return el.closest("[data-arohaa-zip-form]") ?? el.closest("form")
}
