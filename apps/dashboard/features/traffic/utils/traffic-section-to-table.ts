import type {
  TrafficBreakdownTable,
  TrafficTableSection,
} from "@/features/traffic/model/traffic"

export function trafficSectionToBreakdownTable(
  section: TrafficTableSection
): TrafficBreakdownTable {
  return {
    columns: section.columns.map((col) => ({
      id: col.key,
      label: col.label,
      align: col.align,
    })),
    rows: section.rows,
  }
}
