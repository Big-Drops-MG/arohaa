import { track } from "../core/tracker"
import { markFiStepComplete, markFiStepView } from "./fi-capture"

function readStep(props: Record<string, unknown>): {
  stepIndex: number
  stepName?: string
} | null {
  const raw = props.stepIndex
  const stepIndex = typeof raw === "number" ? raw : Number(raw)
  if (!Number.isFinite(stepIndex) || stepIndex < 1) return null
  const stepName =
    typeof props.stepName === "string" && props.stepName.trim()
      ? props.stepName
      : undefined
  return { stepIndex, stepName }
}

export function applyFormStepSemantics(
  event: string,
  props: Record<string, unknown>,
): void {
  if (event !== "form_step_view" && event !== "form_step_complete") return
  const step = readStep(props)
  if (!step) return
  if (event === "form_step_view") markFiStepView(step.stepIndex, step.stepName)
  else markFiStepComplete(step.stepIndex, step.stepName)
}

export function trackFormStepView(
  stepIndex: number,
  props?: { formId?: string; stepName?: string },
): void {
  if (!Number.isFinite(stepIndex) || stepIndex < 1) return
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
  track("form_step_complete", {
    stepIndex,
    ...(props?.formId ? { formId: props.formId } : {}),
    ...(props?.stepName ? { stepName: props.stepName } : {}),
  })
}
