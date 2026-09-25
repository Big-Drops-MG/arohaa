import { track } from "../core/tracker"
import { markFiStepComplete, markFiStepView } from "./fi-capture"

export function trackFormStepView(
  stepIndex: number,
  props?: { formId?: string; stepName?: string },
): void {
  if (!Number.isFinite(stepIndex) || stepIndex < 1) return
  markFiStepView(stepIndex, props?.stepName)
  track("form_step_view", {
    stepIndex,
    ...(props?.formId ? { formId: props.formId } : {}),
    ...(props?.stepName ? { stepName: props.stepName } : {}),
  })
}

export function trackFormStepComplete(
  stepIndex: number,
  props?: { formId?: string; stepName?: string },
): void {
  if (!Number.isFinite(stepIndex) || stepIndex < 1) return
  markFiStepComplete(stepIndex, props?.stepName)
  track("form_step_complete", {
    stepIndex,
    ...(props?.formId ? { formId: props.formId } : {}),
    ...(props?.stepName ? { stepName: props.stepName } : {}),
  })
}
