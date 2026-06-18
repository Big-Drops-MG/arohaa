import { track } from "../core/tracker"

export function trackZipStart(formId?: string): void {
  track("zip_start", formId ? { formId } : {})
}

export function trackZipSubmit(formId?: string): void {
  track("zip_submit", formId ? { formId } : {})
}
