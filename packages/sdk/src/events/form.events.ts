import { track } from "../core/tracker"

export function trackFormStart(formId?: string): void {
  track("form_start", { formId })
}

export function trackFormSubmit(formId?: string): void {
  track("form_submit", { formId })
}

export function trackFormSuccess(formId?: string): void {
  track("form_success", { formId })
}
