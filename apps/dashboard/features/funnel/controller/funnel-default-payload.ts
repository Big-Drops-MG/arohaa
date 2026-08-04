import type { OverviewLandingFormType } from "@/features/overview/model/overview"
import type {
  FunnelFieldDropOff,
  FunnelMetricKpi,
  FunnelStep,
} from "@/features/funnel/model/funnel"
import { funnelKpiMetricIdAtIndex } from "@/features/funnel/model/funnel"

const FUNNEL_BASE_LABELS = ["Landing Page Visits", "Interactions"] as const

const DEFAULT_MULTI_STEP_LABELS = [] as const

function funnelTailLabels(
  formType: OverviewLandingFormType
): readonly string[] {
  if (formType === "none") return ["Service Clicked"]
  return formType === "zip"
    ? (["Zip Started", "Zip Submitted"] as const)
    : (["Form Started", "Form Submitted"] as const)
}

export function defaultFunnelSteps(
  formType: OverviewLandingFormType
): FunnelStep[] {
  const labels = [...FUNNEL_BASE_LABELS, ...funnelTailLabels(formType)]
  return labels.map((label) => ({
    label,
    value: "0",
  }))
}

export function defaultFunnelMetricKpis(
  formType: OverviewLandingFormType
): FunnelMetricKpi[] {
  if (formType === "none") {
    return [
      { id: "landing-page-visits", label: "Landing Page Visits", value: "0" },
      { id: "interactions", label: "Interactions", value: "0" },
      { id: "form-submitted", label: "Service Clicked", value: "0" },
    ]
  }

  const labels = [...FUNNEL_BASE_LABELS, ...funnelTailLabels(formType)]
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
