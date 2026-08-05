"use client"

import { useEffect, useMemo, useState } from "react"
import { Button } from "@workspace/ui/components/button"
import { cn } from "@workspace/ui/lib/utils"
import {
  buildRetentionMatrix,
  type CohortRetentionRow,
} from "../utils/retention-matrix"

const PAGE_SIZE = 15

type Props = {
  data: CohortRetentionRow[]
  maxWeeks?: number
}

export function CohortRetentionGrid({ data, maxWeeks = 8 }: Props) {
  const matrix = useMemo(
    () => buildRetentionMatrix(data, maxWeeks),
    [data, maxWeeks]
  )
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE)

  useEffect(() => {
    setVisibleCount(PAGE_SIZE)
  }, [data])

  const visibleRows = matrix.slice(0, visibleCount)
  const hasMore = visibleCount < matrix.length
  const remaining = Math.max(0, matrix.length - visibleCount)

  return (
    <div className="min-h-0 flex-1">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[640px] border-collapse text-sm">
          <thead>
            <tr className="border-b border-border">
              <th
                scope="col"
                className="px-5 py-2.5 text-left text-xs font-semibold whitespace-nowrap text-muted-foreground sm:px-6"
              >
                Cohort
              </th>
              <th
                scope="col"
                className="px-5 py-2.5 text-left text-xs font-semibold whitespace-nowrap text-muted-foreground sm:px-6"
              >
                Users
              </th>
              {Array.from({ length: maxWeeks + 1 }).map((_, i) => (
                <th
                  key={i}
                  scope="col"
                  className="px-2 py-2.5 text-center text-xs font-semibold whitespace-nowrap text-muted-foreground"
                >
                  Week {i}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {visibleRows.map((row) => (
              <tr
                key={`${row.cohortWeek}-${row.channel || "all"}`}
                className="border-b border-border/70 last:border-0"
              >
                <td className="px-5 py-2.5 font-medium whitespace-nowrap text-foreground sm:px-6">
                  <div>{row.cohortWeek}</div>
                  {row.channel !== undefined ? (
                    <div
                      className="mt-0.5 max-w-[140px] truncate text-xs font-normal text-muted-foreground"
                      title={row.channel}
                    >
                      {row.channel}
                    </div>
                  ) : null}
                </td>
                <td className="px-5 py-2.5 text-muted-foreground tabular-nums sm:px-6">
                  {row.totalUsers.toLocaleString()}
                </td>
                {row.weeks.map((week) => {
                  if (week.activeUsers === null) {
                    return <td key={week.weekNumber} className="px-2 py-2" />
                  }

                  const intensity = Math.min(
                    1,
                    Math.max(0.08, week.retentionPercent / 100)
                  )

                  return (
                    <td key={week.weekNumber} className="min-w-[56px] p-1">
                      <div
                        className="flex h-9 w-full cursor-default items-center justify-center rounded-md border border-neutral-200/60"
                        style={{
                          backgroundColor: `color-mix(in oklab, oklch(0.205 0 0) ${Math.round(intensity * 100)}%, white)`,
                        }}
                        title={`Week ${week.weekNumber}: ${week.activeUsers} users · ${week.retentionPercent.toFixed(1)}%`}
                      >
                        <span
                          className={cn(
                            "text-xs font-medium tabular-nums",
                            intensity > 0.45 ? "text-white" : "text-neutral-900"
                          )}
                        >
                          {week.retentionPercent.toFixed(1)}%
                        </span>
                      </div>
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>

        {matrix.length === 0 ? (
          <div className="px-5 py-10 text-center text-sm text-muted-foreground sm:px-6">
            No retention data for this range yet.
          </div>
        ) : null}
      </div>

      {matrix.length > 0 ? (
        <div className="mt-3 flex flex-col items-center gap-2 border-t border-border pt-3">
          <p className="text-xs text-muted-foreground">
            Showing {visibleRows.length} of {matrix.length} cohorts
          </p>
          {hasMore ? (
            <Button
              variant="outline"
              size="sm"
              className="h-8 rounded-lg border-neutral-200 bg-white shadow-xs"
              onClick={() =>
                setVisibleCount((count) =>
                  Math.min(count + PAGE_SIZE, matrix.length)
                )
              }
            >
              Load more ({Math.min(PAGE_SIZE, remaining)} more)
            </Button>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}
