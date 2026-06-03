import { cn } from "@workspace/ui/lib/utils"
import type { TrafficBreakdownTable } from "@/features/traffic/model/traffic"
import { sortTrafficTableRows } from "@/features/traffic/utils/sort-traffic-table-rows"

type TrafficBreakdownTableViewProps = {
  table: TrafficBreakdownTable
  emptyMessage?: string
  sortByColumnId?: string | null
}

export function TrafficBreakdownTableView({
  table,
  emptyMessage = "No data for this period.",
  sortByColumnId,
}: TrafficBreakdownTableViewProps) {
  const { columns, rows } = sortTrafficTableRows(table, sortByColumnId)

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
                  col.align === "right" ? "text-right" : "text-left"
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
            rows.map((row, rowIndex) => (
              <tr
                key={`${rowIndex}-${row[columns[0]?.id ?? "row"]}`}
                className="border-b border-border last:border-b-0"
              >
                {columns.map((col) => (
                  <td
                    key={col.id}
                    className={cn(
                      "px-5 py-3 font-medium text-foreground sm:px-6",
                      col.align === "right"
                        ? "text-right tabular-nums"
                        : "text-left"
                    )}
                  >
                    {row[col.id] ?? "-"}
                  </td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  )
}
