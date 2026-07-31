import React from "react"
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  CardAction,
} from "@workspace/ui/components/card"
import { Button } from "@workspace/ui/components/button"
import { Download } from "lucide-react"
import {
  buildRetentionMatrix,
  type CohortRetentionRow,
} from "../utils/retention-matrix"
import { exportRetentionCsv } from "../utils/export-csv"

interface Props {
  data: CohortRetentionRow[]
  maxWeeks?: number
}

export function CohortRetentionGrid({ data, maxWeeks = 8 }: Props) {
  const matrix = buildRetentionMatrix(data, maxWeeks)

  return (
    <Card className="max-w-full">
      <CardHeader>
        <CardTitle>Cohort Retention</CardTitle>
        <CardAction>
          <Button
            variant="outline"
            size="sm"
            onClick={() => exportRetentionCsv(matrix, maxWeeks)}
          >
            <Download className="mr-2 h-4 w-4" />
            Export CSV
          </Button>
        </CardAction>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto pb-4">
          <table className="w-full border-collapse text-left text-sm">
            <thead>
              <tr>
                <th className="border-b px-4 py-3 font-medium whitespace-nowrap text-muted-foreground">
                  Cohort
                </th>
                <th className="border-b px-4 py-3 font-medium whitespace-nowrap text-muted-foreground">
                  Users
                </th>
                {Array.from({ length: maxWeeks + 1 }).map((_, i) => (
                  <th
                    key={i}
                    className="border-b px-2 py-3 text-center font-medium whitespace-nowrap text-muted-foreground"
                  >
                    Week {i}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {matrix.map((row) => (
                <tr
                  key={`${row.cohortWeek}-${row.channel || "all"}`}
                  className="border-b transition-colors last:border-0 hover:bg-muted/50"
                >
                  <td className="px-4 py-3 font-medium whitespace-nowrap">
                    <div>{row.cohortWeek}</div>
                    {row.channel !== undefined && (
                      <div
                        className="mt-0.5 max-w-[120px] truncate text-xs font-normal text-muted-foreground"
                        title={row.channel}
                      >
                        {row.channel}
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-3 font-medium text-muted-foreground">
                    {row.totalUsers}
                  </td>
                  {row.weeks.map((week) => {
                    if (week.activeUsers === null) {
                      return (
                        <td key={week.weekNumber} className="px-2 py-2"></td>
                      )
                    }

                    const opacity = Math.max(0.05, week.retentionPercent / 100)

                    return (
                      <td key={week.weekNumber} className="min-w-[60px] p-1">
                        <div
                          className="group relative flex h-10 w-full cursor-default items-center justify-center rounded transition-all"
                          style={{
                            backgroundColor: `hsl(var(--primary) / ${opacity})`,
                          }}
                        >
                          <span
                            className={`text-xs font-medium ${opacity > 0.4 ? "text-primary-foreground" : "text-foreground"}`}
                          >
                            {week.retentionPercent.toFixed(1)}%
                          </span>

                          {/* Hover Detail Tooltip */}
                          <div className="pointer-events-none absolute bottom-full left-1/2 z-50 mb-2 hidden -translate-x-1/2 group-hover:block">
                            <div className="rounded-md border bg-popover p-2 text-xs whitespace-nowrap text-popover-foreground shadow-md">
                              <p className="mb-1 font-semibold">
                                Week {week.weekNumber}
                              </p>
                              <p className="text-muted-foreground">
                                <span className="text-foreground">
                                  {week.activeUsers}
                                </span>{" "}
                                Users returned
                              </p>
                              <p className="text-muted-foreground">
                                <span className="text-foreground">
                                  {week.retentionPercent.toFixed(1)}%
                                </span>{" "}
                                retention
                              </p>
                            </div>
                            <div className="absolute top-full left-1/2 -mt-[1px] -translate-x-1/2 border-4 border-transparent border-t-border"></div>
                            <div className="absolute top-full left-1/2 -mt-[2px] -translate-x-1/2 border-4 border-transparent border-t-popover"></div>
                          </div>
                        </div>
                      </td>
                    )
                  })}
                </tr>
              ))}
            </tbody>
          </table>
          {matrix.length === 0 && (
            <div className="py-8 text-center text-muted-foreground">
              No cohort data available for the selected range.
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
