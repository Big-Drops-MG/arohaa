import { track } from "../core/tracker"
import { registerSemanticHook } from "../core/semantic-hooks"
import {
  armFiCapture,
  markFiFormComplete,
  markFiFormSubmit,
} from "./fi-capture"
import {
  markBehaviorFormStart,
  markBehaviorFormSubmit,
} from "./behavior-summary"
import { applyFormStepSemantics } from "./form-step.events"

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

function readFormId(props: Record<string, unknown>): string | undefined {
  const raw = props.formId
  return typeof raw === "string" && raw.trim() ? raw.trim() : undefined
}

export function applyFormSemantics(
  event: string,
  props: Record<string, unknown>,
): void {
  if (event === "form_start") {
    armFiCapture(readFormId(props))
    markBehaviorFormStart()
  } else if (event === "form_submit") {
    markFiFormSubmit(readFormId(props))
    markBehaviorFormSubmit()
  } else if (event === "form_success") {
    markFiFormComplete(readFormId(props))
    markBehaviorFormSubmit()
  } else {
    applyFormStepSemantics(event, props)
  }
}

export function installFormSemantics(): void {
  registerSemanticHook(applyFormSemantics)
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
