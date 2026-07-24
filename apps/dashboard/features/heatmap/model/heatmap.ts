import type {
  OverviewDateRangeId,
  OverviewDateRangeOption,
} from "@/features/overview/model/overview"

export type HeatmapMode = "click" | "scroll" | "attention"
export type HeatmapDevice = "all" | "mobile" | "tablet" | "desktop"

export const HEATMAP_DEFAULT_OPACITY = 0.65

export type HeatmapCell = {
  gridX: number
  gridY: number
  value: number
}

export type HeatmapPoint = {
  x: number
  y: number
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
  points: HeatmapPoint[]
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
  value: Exclude<HeatmapDevice, "all">
  label: string
}> = [
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
  if (value === "mobile" || value === "tablet" || value === "desktop") {
    return value
  }
  return "desktop"
}
