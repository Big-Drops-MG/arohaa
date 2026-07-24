import type { ExperimentsTableSection } from "@/features/experiments/model/experiments"
import { experimentVariantRowId } from "@/features/experiments/utils/experiment-table-columns"
import type { TrafficBreakdownTable } from "@/features/traffic/model/traffic"

export function experimentsSectionToBreakdownTable(
  section: ExperimentsTableSection
): TrafficBreakdownTable {
  const firstColumnKey = section.columns[0]?.key

  return {
    columns: section.columns.map((col) => ({
      id: col.key,
      label: col.label,
      align: col.key === firstColumnKey ? "left" : "right",
    })),
    rows: section.rows.map((row) => {
      const variant = row.variant?.trim()
      if (!variant) return row

      return {
        ...row,
        variantId: experimentVariantRowId(variant),
      }
    }),
  }
}
