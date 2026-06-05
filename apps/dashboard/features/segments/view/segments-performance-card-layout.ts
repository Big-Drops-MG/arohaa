export const segmentsPerformanceCardShellClassName =
  "flex h-full max-w-none flex-col pb-2"

export const segmentsPerformanceCompactCardContentClassName =
  "flex-1 overflow-x-auto p-0 pb-2"

export const segmentsPerformanceTallCardContentClassName =
  "min-h-[23.5rem] flex-1 overflow-x-auto p-0 pb-2"

export const SEGMENTS_LOCATION_PREVIEW_ROW_LIMIT = 3

export type SegmentsPerformanceCardSize = "compact" | "tall"

export function segmentsPerformanceCardContentClassName(
  size: SegmentsPerformanceCardSize
): string {
  return size === "compact"
    ? segmentsPerformanceCompactCardContentClassName
    : segmentsPerformanceTallCardContentClassName
}
