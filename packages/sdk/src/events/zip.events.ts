import { track } from "../core/tracker"

export function trackZipSubmit(formId?: string): void {
  track("zip_submit", formId ? { formId } : {})
}
