import type { OverviewLandingFormType } from "@/features/overview/model/overview"
import type {
  FunnelFieldDropOff,
  FunnelMetricKpi,
  FunnelStep,
} from "@/features/funnel/model/funnel"
import { funnelKpiMetricIdAtIndex } from "@/features/funnel/model/funnel"

const FUNNEL_BASE_LABELS = ["Landing Page Visits", "Interactions"] as const

const DEFAULT_MULTI_STEP_LABELS = [
  "Step 1",
  "Step 2",
  "Step 3",
  "Final Submit",
] as const

function funnelTailLabels(
  formType: OverviewLandingFormType
): readonly [string, string] {
  return formType === "zip"
    ? (["Zip Started", "Zip Submitted"] as const)
    : (["Form Started", "Form Submitted"] as const)
}

export function defaultFunnelSteps(
  formType: OverviewLandingFormType
): FunnelStep[] {
  const labels = [...FUNNEL_BASE_LABELS, ...funnelTailLabels(formType)] as const
  return labels.map((label) => ({
    label,
    value: "0",
  }))
}

export function defaultFunnelMetricKpis(
  formType: OverviewLandingFormType
): FunnelMetricKpi[] {
  const labels = [...FUNNEL_BASE_LABELS, ...funnelTailLabels(formType)] as const
  return labels.map((label, index) => ({
    id: funnelKpiMetricIdAtIndex(index),
    label,
    value: "0",
  }))
}

export function defaultMultiStepFormTracking(): FunnelStep[] {
  return DEFAULT_MULTI_STEP_LABELS.map((label) => ({
    label,
    value: "0",
  }))
}

export function defaultFormDropOffByField(): FunnelFieldDropOff[] {
  return []
}
