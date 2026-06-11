import { cn } from "@workspace/ui/lib/utils"
import type { ExperimentTableHighlight } from "@/features/experiments/model/experiments"
import type { TrafficBreakdownTable } from "@/features/traffic/model/traffic"

type ExperimentsBreakdownTableViewProps = {
  table: TrafficBreakdownTable
  emptyMessage?: string
  highlight?: ExperimentTableHighlight
}

function isBoldRow(
  row: Record<string, string>,
  highlight: ExperimentTableHighlight | undefined
): boolean {
  const variantId = row.variantId?.trim()
  if (!variantId || !highlight?.boldRowVariantIds?.length) return false
  return highlight.boldRowVariantIds.includes(variantId)
}

function isBoldCell(
  columnId: string,
  highlight: ExperimentTableHighlight | undefined
): boolean {
  if (!highlight?.boldColumnIds?.length) return false
  return highlight.boldColumnIds.includes(columnId)
}

export function ExperimentsBreakdownTableView({
  table,
  emptyMessage = "No data for this period.",
  highlight,
}: ExperimentsBreakdownTableViewProps) {
  const { columns, rows } = table

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[280px] border-collapse text-sm">
        <thead>
          <tr className="border-b border-border">
            {columns.map((col) => (
              <th
                key={col.id}
                scope="col"
                className={cn(
                  "px-5 py-2.5 text-xs font-semibold text-muted-foreground sm:px-6",
                  col.align === "right" ? "text-right" : "text-left",
                  isBoldCell(col.id, highlight) && "font-bold text-foreground"
                )}
              >
                {col.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr>
              <td
                colSpan={columns.length}
                className="px-5 py-8 text-center text-sm text-muted-foreground sm:px-6"
              >
                {emptyMessage}
              </td>
            </tr>
          ) : (
            rows.map((row, rowIndex) => {
              const boldRow = isBoldRow(row, highlight)

              return (
                <tr
                  key={`${rowIndex}-${row[columns[0]?.id ?? "row"]}`}
                  className="border-b border-border last:border-b-0"
                >
                  {columns.map((col) => (
                    <td
                      key={col.id}
                      className={cn(
                        "px-5 py-3 text-foreground sm:px-6",
                        col.align === "right"
                          ? "text-right tabular-nums"
                          : "text-left",
                        boldRow || isBoldCell(col.id, highlight)
                          ? "font-bold"
                          : "font-medium"
                      )}
                    >
                      {row[col.id] ?? "-"}
                    </td>
                  ))}
                </tr>
              )
            })
          )}
        </tbody>
      </table>
    </div>
  )
}
