import type {
  OverviewAlert,
  OverviewTrafficStat,
} from "@/features/overview/model/overview"

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
