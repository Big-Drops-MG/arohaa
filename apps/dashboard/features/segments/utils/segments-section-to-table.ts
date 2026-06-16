import type { SegmentsTableSection } from "@/features/segments/model/segments"
import type { TrafficBreakdownTable } from "@/features/traffic/model/traffic"

export function segmentsSectionToBreakdownTable(
  section: SegmentsTableSection
): TrafficBreakdownTable {
  return {
    columns: section.columns.map((col) => ({
      id: col.key,
      label: col.label,
      align: col.key === "label" ? "left" : "right",
    })),
    rows: section.rows,
  }
}
