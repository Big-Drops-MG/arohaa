import type {
  TrafficBreakdownColumn,
  TrafficBreakdownTable,
} from "@/features/traffic/model/traffic"

/** Time-series dimension columns that must stay chronological. */
const SERIAL_ORDER_COLUMN_IDS = new Set(["date", "time"])

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

export function isSerialOrderTable(columns: TrafficBreakdownColumn[]): boolean {
  return columns.some((col) => SERIAL_ORDER_COLUMN_IDS.has(col.id))
}

function sortColumnForTable(columns: TrafficBreakdownColumn[]): string | null {
  if (columns.some((col) => col.id === "visitors")) return "visitors"

  const numericColumn = columns.find(
    (col) => col.align === "right" && col.id !== "rate"
  )
  return numericColumn?.id ?? null
}

/**
 * Sort metric rows descending by the primary numeric column.
 * Preserves chronological order for time/date series.
 *
 * - `sortColumnId === ""` or `null` → preserve input order
 * - `sortColumnId` omitted → auto: serial tables preserved, else visitors/metric DESC
 * - `sortColumnId` set → sort that column DESC
 */
export function sortTrafficTableRows(
  table: TrafficBreakdownTable,
  sortColumnId?: string | null
): TrafficBreakdownTable {
  if (sortColumnId === "" || sortColumnId === null) {
    return table
  }

  if (sortColumnId === undefined && isSerialOrderTable(table.columns)) {
    return table
  }

  const columnId = sortColumnId ?? sortColumnForTable(table.columns)
  if (!columnId || table.rows.length <= 1) return table

  const rows = [...table.rows].sort(
    (a, b) =>
      parseTrafficNumericValue(b[columnId]) -
      parseTrafficNumericValue(a[columnId])
  )

  return { ...table, rows }
}

/** Desc by best rate across right-aligned columns (FSR/ZSR), then by first rate col. */
export function sortTrafficTableRowsByMaxRate(
  table: TrafficBreakdownTable
): TrafficBreakdownTable {
  const rateColumnIds = table.columns
    .filter((col) => col.align === "right")
    .map((col) => col.id)
  if (rateColumnIds.length === 0 || table.rows.length <= 1) {
    return sortTrafficTableRows(table)
  }

  const rows = [...table.rows].sort((a, b) => {
    const maxA = Math.max(
      ...rateColumnIds.map((id) => parseTrafficNumericValue(a[id]))
    )
    const maxB = Math.max(
      ...rateColumnIds.map((id) => parseTrafficNumericValue(b[id]))
    )
    if (maxB !== maxA) return maxB - maxA
    const primary = rateColumnIds[0]
    if (!primary) return 0
    return (
      parseTrafficNumericValue(b[primary]) -
      parseTrafficNumericValue(a[primary])
    )
  })

  return { ...table, rows }
}
