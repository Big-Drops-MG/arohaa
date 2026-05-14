import type {
  OverviewAlert,
  OverviewFunnelStep,
  OverviewLandingFormType,
  OverviewTrafficStat,
} from "@/features/overview/model/overview"

const FUNNEL_BASE_LABELS = ["Landing Page Visits", "Interactions"] as const

function funnelTailLabels(
  formType: OverviewLandingFormType
): readonly [string, string] {
  return formType === "zip"
    ? (["Zip Started", "Zip Submitted"] as const)
    : (["Form Started", "Form Submitted"] as const)
}

const TRAFFIC_STATS = [
  { label: "Unique Visitors", valueKind: "number" as const },
  { label: "Avg Session Duration", valueKind: "string" as const },
] as const

const SEGMENT_STATS = [
  { label: "Top City", valueKind: "string" as const },
  { label: "Best Day", valueKind: "string" as const },
] as const

function placeholderValue(kind: "number" | "string"): string {
  return kind === "number" ? "0" : "-"
}

export function defaultFunnelSteps(
  formType: OverviewLandingFormType
): OverviewFunnelStep[] {
  const labels = [...FUNNEL_BASE_LABELS, ...funnelTailLabels(formType)] as const
  return labels.map((label) => ({
    label,
    value: placeholderValue("number"),
  }))
}

export function defaultTrafficStats(): OverviewTrafficStat[] {
  return TRAFFIC_STATS.map(({ label, valueKind }) => ({
    label,
    value: placeholderValue(valueKind),
  }))
}

export function defaultSegmentStats(): OverviewTrafficStat[] {
  return SEGMENT_STATS.map(({ label, valueKind }) => ({
    label,
    value: placeholderValue(valueKind),
  }))
}

export const defaultAlerts: OverviewAlert[] = []
