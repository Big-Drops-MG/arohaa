import type {
  TrafficBreakdownTable,
  TrafficTableColumn,
} from "@/features/traffic/model/traffic"

export function parseTrafficNumericValue(raw: string | undefined): number {
  if (!raw || raw === "-") return 0

  const trimmed = raw.trim()
  if (trimmed.endsWith("%")) {
    const n = Number.parseFloat(trimmed.slice(0, -1))
    return Number.isFinite(n) ? n : 0
  }

  const normalized = trimmed.replace(/,/g, "")
  if (normalized.endsWith("K")) {
    const n = Number.parseFloat(normalized.slice(0, -1))
    return Number.isFinite(n) ? n * 1_000 : 0
  }
  if (normalized.endsWith("M")) {
    const n = Number.parseFloat(normalized.slice(0, -1))
    return Number.isFinite(n) ? n * 1_000_000 : 0
  }

  const n = Number.parseFloat(normalized)
  return Number.isFinite(n) ? n : 0
}

function sortColumnForTable(columns: TrafficTableColumn[]): string | null {
  if (columns.some((col) => col.id === "visitors")) return "visitors"

  const numericColumn = columns.find(
    (col) => col.align === "right" && col.id !== "rate"
  )
  return numericColumn?.id ?? null
}

export function sortTrafficTableRows(
  table: TrafficBreakdownTable,
  sortColumnId?: string | null
): TrafficBreakdownTable {
  const columnId = sortColumnId ?? sortColumnForTable(table.columns)
  if (!columnId || table.rows.length <= 1) return table

  const rows = [...table.rows].sort(
    (a, b) =>
      parseTrafficNumericValue(b[columnId]) -
      parseTrafficNumericValue(a[columnId])
  )

  return { ...table, rows }
}
