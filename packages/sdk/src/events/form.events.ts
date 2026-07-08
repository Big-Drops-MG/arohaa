import { track } from "../core/tracker"

type FormEventProps = {
  formId?: string
  zip?: string
}

function buildFormProps(props?: FormEventProps): Record<string, string> | undefined {
  if (!props?.formId && !props?.zip) return undefined
  const out: Record<string, string> = {}
  if (props.formId) out.formId = props.formId
  if (props.zip) out.zip = props.zip
  return out
}

export function trackFormStart(formId?: string): void {
  track("form_start", formId ? { formId } : {})
}

export function trackFormSubmit(formId?: string, zip?: string): void {
  track("form_submit", buildFormProps({ formId, zip }) ?? {})
}

export function trackFormSuccess(formId?: string, zip?: string): void {
  track("form_success", buildFormProps({ formId, zip }) ?? {})
}
