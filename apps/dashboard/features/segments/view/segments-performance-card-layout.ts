import {
  trafficBreakdownCardContentClassName,
  trafficBreakdownCardShellClassName,
} from "@/features/traffic/view/traffic-card-layout"

export const SEGMENTS_PREVIEW_ROW_LIMIT = 5

/** @deprecated Use SEGMENTS_PREVIEW_ROW_LIMIT */
export const SEGMENTS_LOCATION_PREVIEW_ROW_LIMIT = 3

export const segmentsPerformanceCardShellClassName =
  trafficBreakdownCardShellClassName

export type SegmentsPerformanceCardSize = "compact" | "tall"

export function segmentsPerformanceCardContentClassName(
  _size: SegmentsPerformanceCardSize = "compact"
): string {
  void _size
  return trafficBreakdownCardContentClassName
}
