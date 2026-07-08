import { track } from "../core/tracker"

export function trackZipStart(formId?: string): void {
  track("zip_start", formId ? { formId } : {})
}

export function trackZipSubmit(formId?: string, zip?: string): void {
  const props: Record<string, string> = {}
  if (formId) props.formId = formId
  if (zip) props.zip = zip
  track("zip_submit", Object.keys(props).length > 0 ? props : {})
}
