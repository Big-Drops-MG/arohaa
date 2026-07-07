"use client"

import { cn } from "@workspace/ui/lib/utils"
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@workspace/ui/components/card"
import type { SeoResultRow, SeoSortField } from "@/features/seo/model/seo"
import {
  overviewAnalyticCardHeaderClassName,
  overviewAnalyticCardShellClassName,
  overviewSectionHeadingClassName,
} from "@/features/overview/view/overview-card-density"
import { overviewCardPointerFocusResetClassName } from "@/features/overview/view/overview-focus-styles"

const COLUMNS: Array<{
  key: SeoSortField | "pageUrl" | "reportDate"
  label: string
  sortable: boolean
}> = [
  { key: "query", label: "Query", sortable: true },
  { key: "pageUrl", label: "Page", sortable: false },
  { key: "clicks", label: "Clicks", sortable: true },
  { key: "impressions", label: "Impressions", sortable: true },
  { key: "ctr", label: "CTR", sortable: true },
  { key: "position", label: "Position", sortable: true },
  { key: "reportDate", label: "Date", sortable: false },
]

type SeoResultsTableProps = {
  rows: SeoResultRow[]
  sortBy: SeoSortField
  sortOrder: "asc" | "desc"
  onSort: (field: SeoSortField) => void
}

function formatDate(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  })
}

function cellValue(row: SeoResultRow, key: (typeof COLUMNS)[number]["key"]) {
  if (key === "reportDate") return formatDate(row.reportDate)
  if (key === "ctr") return `${row.ctr.toFixed(1)}%`
  if (key === "position") return row.position.toFixed(1)
  if (key === "pageUrl") {
    try {
      const url = new URL(row.pageUrl)
      return url.pathname || row.pageUrl
    } catch {
      return row.pageUrl
    }
  }
  if (key === "clicks" || key === "impressions") {
    return row[key].toLocaleString("en-US")
  }
  return row[key as SeoSortField]
}

export function SeoResultsTable({
  rows,
  sortBy,
  sortOrder,
  onSort,
}: SeoResultsTableProps) {
  return (
    <Card
      className={cn(
        overviewCardPointerFocusResetClassName,
        overviewAnalyticCardShellClassName,
        "max-w-none gap-0 py-0"
      )}
    >
      <CardHeader className={overviewAnalyticCardHeaderClassName}>
        <CardTitle className={overviewSectionHeadingClassName}>
          Search queries
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <div
          className="grid border-b border-border px-5 py-2.5 sm:px-6"
          style={{
            gridTemplateColumns: `2fr 1.5fr repeat(5, minmax(0, 1fr))`,
          }}
        >
          {COLUMNS.map((col) => {
            const active = col.sortable && sortBy === col.key
            return (
              <button
                key={col.key}
                type="button"
                disabled={!col.sortable}
                onClick={() => {
                  if (col.sortable) onSort(col.key as SeoSortField)
                }}
                className={cn(
                  "text-left text-sm font-medium",
                  col.sortable
                    ? "cursor-pointer text-muted-foreground hover:text-foreground"
                    : "cursor-default text-muted-foreground",
                  active && "text-foreground"
                )}
              >
                {col.label}
                {active ? (sortOrder === "asc" ? " ↑" : " ↓") : null}
              </button>
            )
          })}
        </div>
        {rows.length === 0 ? (
          <p className="px-5 py-8 text-sm text-muted-foreground sm:px-6">
            No SEO results for this date range. Sync search console data to
            populate this table.
          </p>
        ) : (
          rows.map((row, rowIndex) => (
            <div
              key={row.id}
              className={cn(
                "grid px-5 py-3 sm:px-6",
                rowIndex < rows.length - 1 && "border-b border-border/60"
              )}
              style={{
                gridTemplateColumns: `2fr 1.5fr repeat(5, minmax(0, 1fr))`,
              }}
            >
              {COLUMNS.map((col) => (
                <span
                  key={col.key}
                  className="truncate text-sm text-foreground tabular-nums"
                  title={String(cellValue(row, col.key))}
                >
                  {cellValue(row, col.key)}
                </span>
              ))}
            </div>
          ))
        )}
      </CardContent>
    </Card>
  )
}
