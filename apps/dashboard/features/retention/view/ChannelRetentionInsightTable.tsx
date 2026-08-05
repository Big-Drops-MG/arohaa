"use client"

import { Fragment, useEffect, useMemo, useState } from "react"
import { ChevronDown, Search } from "lucide-react"
import { Button } from "@workspace/ui/components/button"
import { Input } from "@workspace/ui/components/input"
import { cn } from "@workspace/ui/lib/utils"
import {
  buildChannelRetentionSummary,
  formatRetentionPercent,
  splitDimensionLabel,
  type ChannelRetentionSummary,
  type CohortMatrixRow,
  type CohortRetentionRow,
  type RetentionSplitBy,
} from "../utils/retention-matrix"

const PAGE_SIZE = 20

type SortKey = "users" | "week1" | "week4" | "week8" | "channel"

type Props = {
  data: CohortRetentionRow[]
  splitBy: Exclude<RetentionSplitBy, "none">
  maxWeeks?: number
}

function retentionCellClass(percent: number | null): string {
  if (percent == null) return "text-muted-foreground"
  if (percent >= 40) return "font-medium text-foreground"
  if (percent >= 15) return "text-foreground"
  return "text-muted-foreground"
}

function RetentionHeatCell({
  week,
}: {
  week: CohortMatrixRow["weeks"][number]
}) {
  if (week.activeUsers === null) {
    return <td className="px-2 py-2" />
  }

  const intensity = Math.min(1, Math.max(0.08, week.retentionPercent / 100))

  return (
    <td className="min-w-[52px] p-1">
      <div
        className="flex h-8 w-full items-center justify-center rounded-md border border-neutral-200/60"
        style={{
          backgroundColor: `color-mix(in oklab, oklch(0.205 0 0) ${Math.round(intensity * 100)}%, white)`,
        }}
        title={`Week ${week.weekNumber}: ${week.activeUsers} users · ${week.retentionPercent.toFixed(1)}%`}
      >
        <span
          className={cn(
            "text-[11px] font-medium tabular-nums",
            intensity > 0.45 ? "text-white" : "text-neutral-900"
          )}
        >
          {week.retentionPercent.toFixed(1)}%
        </span>
      </div>
    </td>
  )
}

function SparkBars({ row }: { row: ChannelRetentionSummary }) {
  const points = [
    row.week1Percent,
    row.week2Percent,
    row.week4Percent,
    row.week8Percent,
  ]
  return (
    <div
      className="flex h-8 items-end gap-0.5"
      title="W1 · W2 · W4 · W8 return"
      aria-hidden
    >
      {points.map((value, i) => {
        const height =
          value == null ? 2 : Math.max(4, Math.round((value / 100) * 32))
        return (
          <div
            key={i}
            className={cn(
              "w-1.5 rounded-sm",
              value == null ? "bg-neutral-200" : "bg-neutral-800"
            )}
            style={{ height }}
          />
        )
      })}
    </div>
  )
}

function sortSummaries(
  rows: ChannelRetentionSummary[],
  sortKey: SortKey
): ChannelRetentionSummary[] {
  const copy = [...rows]
  copy.sort((a, b) => {
    switch (sortKey) {
      case "channel":
        return a.channel.localeCompare(b.channel)
      case "week1":
        return (b.week1Percent ?? -1) - (a.week1Percent ?? -1)
      case "week4":
        return (b.week4Percent ?? -1) - (a.week4Percent ?? -1)
      case "week8":
        return (b.week8Percent ?? -1) - (a.week8Percent ?? -1)
      case "users":
      default:
        if (b.totalUsers !== a.totalUsers) return b.totalUsers - a.totalUsers
        return a.channel.localeCompare(b.channel)
    }
  })
  return copy
}

function weightedAverage(
  rows: ChannelRetentionSummary[],
  key: "week1Percent" | "week4Percent"
): number | null {
  let weighted = 0
  let weight = 0
  for (const row of rows) {
    const value = row[key]
    if (value == null || row.totalUsers <= 0) continue
    weighted += value * row.totalUsers
    weight += row.totalUsers
  }
  if (weight <= 0) return null
  return weighted / weight
}

export function ChannelRetentionInsightTable({
  data,
  splitBy,
  maxWeeks = 8,
}: Props) {
  const dimension = splitDimensionLabel(splitBy)
  const summaries = useMemo(
    () => buildChannelRetentionSummary(data, maxWeeks),
    [data, maxWeeks]
  )

  const [query, setQuery] = useState("")
  const [sortKey, setSortKey] = useState<SortKey>("users")
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE)
  const [expanded, setExpanded] = useState<string | null>(null)

  useEffect(() => {
    setQuery("")
    setSortKey("users")
    setVisibleCount(PAGE_SIZE)
    setExpanded(null)
  }, [data, splitBy])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    const base = q
      ? summaries.filter((row) => row.channel.toLowerCase().includes(q))
      : summaries
    return sortSummaries(base, sortKey)
  }, [summaries, query, sortKey])

  const visibleRows = filtered.slice(0, visibleCount)
  const hasMore = visibleCount < filtered.length
  const remaining = Math.max(0, filtered.length - visibleCount)

  const totalUsers = summaries.reduce((sum, row) => sum + row.totalUsers, 0)
  const avgW1 = weightedAverage(summaries, "week1Percent")
  const avgW4 = weightedAverage(summaries, "week4Percent")

  const sortButton = (key: SortKey, label: string) => (
    <button
      type="button"
      onClick={() => setSortKey(key)}
      className={cn(
        "text-xs font-semibold whitespace-nowrap transition-colors",
        sortKey === key
          ? "text-foreground"
          : "text-muted-foreground hover:text-foreground"
      )}
    >
      {label}
      {sortKey === key ? " ↓" : ""}
    </button>
  )

  return (
    <div className="min-h-0 flex-1">
      <div className="mb-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
          <span>
            <span className="font-medium text-foreground tabular-nums">
              {summaries.length.toLocaleString()}
            </span>{" "}
            {dimension.toLowerCase()}
            {summaries.length === 1 ? "" : "s"}
          </span>
          <span className="hidden text-neutral-300 sm:inline" aria-hidden>
            ·
          </span>
          <span>
            <span className="font-medium text-foreground tabular-nums">
              {totalUsers.toLocaleString()}
            </span>{" "}
            users
          </span>
          <span className="hidden text-neutral-300 sm:inline" aria-hidden>
            ·
          </span>
          <span>
            Avg W1{" "}
            <span className="font-medium text-foreground tabular-nums">
              {formatRetentionPercent(avgW1)}
            </span>
          </span>
          <span className="hidden text-neutral-300 sm:inline" aria-hidden>
            ·
          </span>
          <span>
            Avg W4{" "}
            <span className="font-medium text-foreground tabular-nums">
              {formatRetentionPercent(avgW4)}
            </span>
          </span>
        </div>
        <div className="relative w-full sm:max-w-[240px]">
          <Search
            className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground"
            aria-hidden
          />
          <Input
            value={query}
            onChange={(e) => {
              setQuery(e.target.value)
              setVisibleCount(PAGE_SIZE)
            }}
            placeholder={`Search ${dimension.toLowerCase()}…`}
            className="h-8 rounded-lg border-neutral-200 bg-white pl-8 text-sm shadow-xs"
            aria-label={`Search ${dimension}`}
          />
        </div>
      </div>

      {splitBy === "utm_id" ? (
        <p className="mb-3 text-xs leading-relaxed text-muted-foreground">
          Each UTM ID is typically one visitor. Rows are ranked by users so you
          can compare who returns at week 1, 2, 4, and 8. Expand a row for the
          full cohort-week curve.
        </p>
      ) : (
        <p className="mb-3 text-xs leading-relaxed text-muted-foreground">
          Aggregated across cohort weeks. Return rates are user-weighted. Expand
          a row to inspect that {dimension.toLowerCase()} by first-visit week.
        </p>
      )}

      <div className="overflow-x-auto">
        <table className="w-full min-w-[720px] border-collapse text-sm">
          <thead>
            <tr className="border-b border-border">
              <th
                scope="col"
                className="w-8 px-2 py-2.5 text-left sm:px-3"
                aria-label="Expand"
              />
              <th scope="col" className="px-3 py-2.5 text-left sm:px-4">
                {sortButton("channel", dimension)}
              </th>
              <th scope="col" className="px-3 py-2.5 text-right sm:px-4">
                {sortButton("users", "Users")}
              </th>
              <th
                scope="col"
                className="px-3 py-2.5 text-right text-xs font-semibold whitespace-nowrap text-muted-foreground sm:px-4"
              >
                Cohorts
              </th>
              <th scope="col" className="px-3 py-2.5 text-right sm:px-4">
                {sortButton("week1", "W1")}
              </th>
              <th
                scope="col"
                className="px-3 py-2.5 text-right text-xs font-semibold whitespace-nowrap text-muted-foreground sm:px-4"
              >
                W2
              </th>
              <th scope="col" className="px-3 py-2.5 text-right sm:px-4">
                {sortButton("week4", "W4")}
              </th>
              <th scope="col" className="px-3 py-2.5 text-right sm:px-4">
                {sortButton("week8", "W8")}
              </th>
              <th
                scope="col"
                className="px-3 py-2.5 text-left text-xs font-semibold whitespace-nowrap text-muted-foreground sm:px-4"
              >
                Curve
              </th>
            </tr>
          </thead>
          <tbody>
            {visibleRows.map((row) => {
              const isOpen = expanded === row.channel
              return (
                <Fragment key={row.channel}>
                  <tr className="border-b border-border/70 last:border-0">
                    <td className="px-2 py-2 sm:px-3">
                      <button
                        type="button"
                        aria-expanded={isOpen}
                        aria-label={
                          isOpen
                            ? `Hide cohorts for ${row.channel}`
                            : `Show cohorts for ${row.channel}`
                        }
                        onClick={() =>
                          setExpanded((current) =>
                            current === row.channel ? null : row.channel
                          )
                        }
                        className="inline-flex size-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-neutral-100 hover:text-foreground"
                      >
                        <ChevronDown
                          className={cn(
                            "size-4 transition-transform",
                            isOpen && "rotate-180"
                          )}
                        />
                      </button>
                    </td>
                    <td className="max-w-[220px] px-3 py-2.5 sm:px-4">
                      <div
                        className="truncate font-medium text-foreground"
                        title={row.channel}
                      >
                        {row.channel}
                      </div>
                    </td>
                    <td className="px-3 py-2.5 text-right text-muted-foreground tabular-nums sm:px-4">
                      {row.totalUsers.toLocaleString()}
                    </td>
                    <td className="px-3 py-2.5 text-right text-muted-foreground tabular-nums sm:px-4">
                      {row.cohortCount.toLocaleString()}
                    </td>
                    <td
                      className={cn(
                        "px-3 py-2.5 text-right tabular-nums sm:px-4",
                        retentionCellClass(row.week1Percent)
                      )}
                    >
                      {formatRetentionPercent(row.week1Percent)}
                    </td>
                    <td
                      className={cn(
                        "px-3 py-2.5 text-right tabular-nums sm:px-4",
                        retentionCellClass(row.week2Percent)
                      )}
                    >
                      {formatRetentionPercent(row.week2Percent)}
                    </td>
                    <td
                      className={cn(
                        "px-3 py-2.5 text-right tabular-nums sm:px-4",
                        retentionCellClass(row.week4Percent)
                      )}
                    >
                      {formatRetentionPercent(row.week4Percent)}
                    </td>
                    <td
                      className={cn(
                        "px-3 py-2.5 text-right tabular-nums sm:px-4",
                        retentionCellClass(row.week8Percent)
                      )}
                    >
                      {formatRetentionPercent(row.week8Percent)}
                    </td>
                    <td className="px-3 py-2 sm:px-4">
                      <SparkBars row={row} />
                    </td>
                  </tr>
                  {isOpen ? (
                    <tr className="border-b border-border/70 bg-neutral-50/80">
                      <td colSpan={9} className="px-3 py-3 sm:px-4">
                        <p className="mb-2 text-xs font-medium text-muted-foreground">
                          Cohort weeks for {row.channel}
                        </p>
                        <div className="overflow-x-auto rounded-lg border border-border bg-white">
                          <table className="w-full min-w-[560px] border-collapse text-sm">
                            <thead>
                              <tr className="border-b border-border">
                                <th className="px-3 py-2 text-left text-xs font-semibold text-muted-foreground">
                                  Cohort
                                </th>
                                <th className="px-3 py-2 text-right text-xs font-semibold text-muted-foreground">
                                  Users
                                </th>
                                {Array.from({ length: maxWeeks + 1 }).map(
                                  (_, i) => (
                                    <th
                                      key={i}
                                      className="px-1 py-2 text-center text-xs font-semibold text-muted-foreground"
                                    >
                                      W{i}
                                    </th>
                                  )
                                )}
                              </tr>
                            </thead>
                            <tbody>
                              {row.cohorts.map((cohort) => (
                                <tr
                                  key={cohort.cohortWeek}
                                  className="border-b border-border/60 last:border-0"
                                >
                                  <td className="px-3 py-2 font-medium whitespace-nowrap text-foreground">
                                    {cohort.cohortWeek}
                                  </td>
                                  <td className="px-3 py-2 text-right text-muted-foreground tabular-nums">
                                    {cohort.totalUsers.toLocaleString()}
                                  </td>
                                  {cohort.weeks.map((week) => (
                                    <RetentionHeatCell
                                      key={week.weekNumber}
                                      week={week}
                                    />
                                  ))}
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </td>
                    </tr>
                  ) : null}
                </Fragment>
              )
            })}
          </tbody>
        </table>

        {summaries.length === 0 ? (
          <div className="px-1 py-10 text-center text-sm text-muted-foreground">
            No retention data for this range yet.
          </div>
        ) : filtered.length === 0 ? (
          <div className="px-1 py-10 text-center text-sm text-muted-foreground">
            No {dimension.toLowerCase()} matches “{query.trim()}”.
          </div>
        ) : null}
      </div>

      {filtered.length > 0 ? (
        <div className="mt-3 flex flex-col items-center gap-2 border-t border-border pt-3">
          <p className="text-xs text-muted-foreground">
            Showing {visibleRows.length} of {filtered.length}{" "}
            {dimension.toLowerCase()}
            {filtered.length === 1 ? "" : "s"}
          </p>
          {hasMore ? (
            <Button
              variant="outline"
              size="sm"
              className="h-8 rounded-lg border-neutral-200 bg-white shadow-xs"
              onClick={() =>
                setVisibleCount((count) =>
                  Math.min(count + PAGE_SIZE, filtered.length)
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
