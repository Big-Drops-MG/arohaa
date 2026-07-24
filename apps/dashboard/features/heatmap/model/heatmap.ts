import type {
  OverviewDateRangeId,
  OverviewDateRangeOption,
} from "@/features/overview/model/overview"

export type HeatmapMode = "click" | "scroll" | "attention"
export type HeatmapDevice = "all" | "mobile" | "tablet" | "desktop"

export type HeatmapCell = {
  gridX: number
  gridY: number
  value: number
}

export type HeatmapScrollBucket = {
  bucket: number
  value: number
}

export type HeatmapSection = {
  selector: string
  dwellMs: number
  views: number
}

export type HeatmapDashboardData = {
  dateRangeOptions: OverviewDateRangeOption[]
  defaultDateRangeId: OverviewDateRangeId
  mode: HeatmapMode
  device: HeatmapDevice
  pageUrl: string | null
  pageUrls: string[]
  cells: HeatmapCell[]
  scrollBuckets: HeatmapScrollBucket[]
  sections: HeatmapSection[]
  maxValue: number
  totalEvents: number
  opacity: number
}

export const HEATMAP_MODES: ReadonlyArray<{
  value: HeatmapMode
  label: string
}> = [
  { value: "click", label: "Click" },
  { value: "scroll", label: "Scroll" },
  { value: "attention", label: "Attention" },
]

export const HEATMAP_DEVICES: ReadonlyArray<{
  value: HeatmapDevice
  label: string
}> = [
  { value: "all", label: "All devices" },
  { value: "desktop", label: "Desktop" },
  { value: "tablet", label: "Tablet" },
  { value: "mobile", label: "Mobile" },
]

export function parseHeatmapMode(
  value: string | null | undefined
): HeatmapMode {
  if (value === "scroll" || value === "attention" || value === "click") {
    return value
  }
  return "click"
}

export function parseHeatmapDevice(
  value: string | null | undefined
): HeatmapDevice {
  if (
    value === "mobile" ||
    value === "tablet" ||
    value === "desktop" ||
    value === "all"
  ) {
    return value
  }
  return "all"
}
