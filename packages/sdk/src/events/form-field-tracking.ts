import { track } from "../core/tracker"
import {
  formIdFromForm,
  isMarkedArohaaField,
  isZipInput,
  resolveMarkedFieldName,
} from "./form-dom.utils"

type FormSessionState = {
  formId?: string
  started: boolean
  succeeded: boolean
  lastField?: string
}

const sessions = new Map<string, FormSessionState>()
const STANDALONE_ZIP_KEY = "standalone-zip"
let fieldTrackingInstalled = false

function sessionKey(form: HTMLFormElement): string {
  return formIdFromForm(form) ?? "default-form"
}

function getSession(key: string): FormSessionState {
  let state = sessions.get(key)
  if (!state) {
    state = { started: false, succeeded: false }
    sessions.set(key, state)
  }
  return state
}

function getFormSession(form: HTMLFormElement): FormSessionState {
  return getSession(sessionKey(form))
}

export function markFormSessionStarted(form: HTMLFormElement): void {
  const state = getFormSession(form)
  state.started = true
  state.formId = formIdFromForm(form)
}

export function markStandaloneZipStarted(): void {
  const state = getSession(STANDALONE_ZIP_KEY)
  state.started = true
  state.formId = "zip"
}

export function markFormSessionSucceeded(formIdValue?: string): void {
  for (const state of sessions.values()) {
    if (!formIdValue || state.formId === formIdValue) {
      state.succeeded = true
    }
  }
}

export function hasFormSessionSucceeded(formIdValue?: string): boolean {
  for (const state of sessions.values()) {
    if (state.succeeded && (!formIdValue || state.formId === formIdValue)) {
      return true
    }
  }
  return false
}

export function trackFormFieldFocus(
  form: HTMLFormElement,
  field: HTMLElement,
): void {
  const state = getFormSession(form)
  if (!state.started) {
    state.started = true
    state.formId = formIdFromForm(form)
  }

  const fieldName = resolveMarkedFieldName(field)
  state.lastField = fieldName
  track("form_field_focus", {
    fieldName,
    ...(state.formId ? { formId: state.formId } : {}),
  })
}

export function trackStandaloneFieldFocus(field: HTMLElement): void {
  const key = isZipInput(field) ? STANDALONE_ZIP_KEY : `standalone:${resolveMarkedFieldName(field)}`
  const state = getSession(key)
  if (!state.started) {
    state.started = true
    state.formId = isZipInput(field) ? "zip" : undefined
  }

  const fieldName = resolveMarkedFieldName(field)
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
      if (!(target instanceof HTMLElement)) return

      const form = target.closest("form")
      if (form) {
        if (!isMarkedArohaaField(target) && !isZipInput(target)) {
          const isGenericField =
            target instanceof HTMLInputElement ||
            target instanceof HTMLTextAreaElement ||
            target instanceof HTMLSelectElement
          if (!isGenericField) return
          const type =
            target instanceof HTMLInputElement
              ? target.type.toLowerCase()
              : ""
          if (
            type === "hidden" ||
            type === "submit" ||
            type === "button"
          ) {
            return
          }
        }
        trackFormFieldFocus(form, target)
        return
      }

      if (isMarkedArohaaField(target)) {
        trackStandaloneFieldFocus(target)
      }
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
