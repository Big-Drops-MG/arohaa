import { track } from "../core/tracker"

type FormSessionState = {
  formId?: string
  started: boolean
  succeeded: boolean
  lastField?: string
}

const sessions = new Map<string, FormSessionState>()
let fieldTrackingInstalled = false

function sessionKey(form: HTMLFormElement): string {
  return formId(form) ?? "default-form"
}

function formId(form: HTMLFormElement): string | undefined {
  const id = form.id?.trim()
  if (id) return id
  const name = form.getAttribute("name")?.trim()
  return name || undefined
}

function resolveFieldName(input: HTMLElement): string {
  const aria = input.getAttribute("aria-label")?.trim()
  if (aria) return aria

  const id = input.id?.trim()
  if (id && typeof document !== "undefined") {
    const label = document.querySelector(`label[for="${CSS.escape(id)}"]`)
    if (label?.textContent?.trim()) return label.textContent.trim()
  }

  if (input instanceof HTMLInputElement || input instanceof HTMLTextAreaElement) {
    const placeholder = input.placeholder?.trim()
    if (placeholder) return placeholder
    const name = input.name?.trim()
    if (name) return name
    if (input.id?.trim()) return input.id.trim()
    if (input.type) return input.type
  }

  return input.tagName.toLowerCase()
}

function isTrackableField(target: EventTarget | null): target is HTMLElement {
  if (!(target instanceof HTMLElement)) return false
  if (target instanceof HTMLInputElement) {
    const type = target.type.toLowerCase()
    return type !== "hidden" && type !== "submit" && type !== "button"
  }
  return (
    target instanceof HTMLTextAreaElement || target instanceof HTMLSelectElement
  )
}

function getSession(form: HTMLFormElement): FormSessionState {
  const key = sessionKey(form)
  let state = sessions.get(key)
  if (!state) {
    state = { started: false, succeeded: false }
    sessions.set(key, state)
  }
  return state
}

export function markFormSessionStarted(form: HTMLFormElement): void {
  const state = getSession(form)
  state.started = true
  state.formId = formId(form)
}

export function markFormSessionSucceeded(formIdValue?: string): void {
  for (const state of sessions.values()) {
    if (!formIdValue || state.formId === formIdValue) {
      state.succeeded = true
    }
  }
}

export function trackFormFieldFocus(
  form: HTMLFormElement,
  field: HTMLElement,
): void {
  const state = getSession(form)
  if (!state.started) {
    state.started = true
    state.formId = formId(form)
  }

  const fieldName = resolveFieldName(field)
  state.lastField = fieldName
  track("form_field_focus", {
    fieldName,
    ...(state.formId ? { formId: state.formId } : {}),
  })
}

function flushAbandonments(): void {
  for (const state of sessions.values()) {
    if (!state.started || state.succeeded || !state.lastField) continue
    track("form_field_abandon", {
      fieldName: state.lastField,
      ...(state.formId ? { formId: state.formId } : {}),
    })
    state.lastField = undefined
  }
}

export function setupFormFieldTracking(): void {
  if (fieldTrackingInstalled || typeof document === "undefined") return
  fieldTrackingInstalled = true

  document.addEventListener(
    "focusin",
    (e) => {
      const target = e.target
      if (!isTrackableField(target)) return
      const form = target.closest("form")
      if (!form) return
      trackFormFieldFocus(form, target)
    },
    true,
  )

  document.addEventListener(
    "visibilitychange",
    () => {
      if (document.visibilityState === "hidden") flushAbandonments()
    },
    true,
  )

  window.addEventListener("pagehide", flushAbandonments, true)
}
