"use client"

import { cn } from "@workspace/ui/lib/utils"
import type {
  IntelligenceBoard,
  IntelligenceCenterPayload,
  IntelligenceWinner,
} from "@/features/data-lab/model/intelligence"
import { InsightsKpiStrip } from "@/features/insights/view/InsightsKpiStrip"
import type { InsightKpi } from "@/features/insights/model/insights"

type IntelligenceCenterProps = {
  data: IntelligenceCenterPayload | null
  kpis?: InsightKpi[]
  isLoading: boolean
}

function WinnerCard({ item }: { item: IntelligenceWinner }) {
  return (
    <div className="flex min-h-[7.5rem] flex-col rounded-xl border border-neutral-200 bg-white p-4 shadow-xs">
      <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
        {item.label}
      </p>
      {item.enoughData ? (
        <>
          <p className="mt-2 text-lg font-semibold tracking-tight text-foreground">
            {item.value}
          </p>
          <p className="mt-auto pt-3 text-xs text-muted-foreground">
            {item.metricLabel}:{" "}
            <span className="font-medium text-foreground tabular-nums">
              {typeof item.metricValue === "number"
                ? item.metricValue.toLocaleString()
                : item.metricValue}
            </span>
            {item.secondaryLabel != null ? (
              <>
                {" · "}
                {item.secondaryLabel}:{" "}
                <span className="font-medium text-foreground tabular-nums">
                  {item.secondaryValue}
                </span>
              </>
            ) : null}
          </p>
        </>
      ) : (
        <p className="mt-2 text-sm text-muted-foreground">
          Not enough data yet
        </p>
      )}
    </div>
  )
}

function BoardCard({ board }: { board: IntelligenceBoard }) {
  return (
    <section className="rounded-xl border border-neutral-200 bg-white shadow-xs">
      <div className="border-b border-neutral-100 px-4 py-3">
        <h3 className="text-sm font-semibold text-foreground">{board.title}</h3>
      </div>
      {board.rows.length === 0 ? (
        <p className="px-4 py-8 text-center text-sm text-muted-foreground">
          Nothing to show in this range yet.
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[20rem] text-left text-sm">
            <thead>
              <tr className="border-b border-neutral-100 text-xs text-muted-foreground">
                <th className="px-4 py-2.5 font-medium">Name</th>
                {board.columns.map((col) => (
                  <th key={col.key} className="px-4 py-2.5 font-medium">
                    {col.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {board.rows.map((row) => (
                <tr
                  key={`${board.id}-${row.label}`}
                  className="border-b border-neutral-50 last:border-0"
                >
                  <td className="px-4 py-2.5 font-medium text-foreground">
                    {row.label}
                  </td>
                  {board.columns.map((col) => (
                    <td
                      key={col.key}
                      className="px-4 py-2.5 text-muted-foreground tabular-nums"
                    >
                      {row.values[col.key] ?? "—"}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  )
}

export function IntelligenceCenter({
  data,
  kpis = [],
  isLoading,
}: IntelligenceCenterProps) {
  const winners = data?.winners ?? []
  const boards = data?.boards ?? []
  const actions = data?.actions ?? []

  if (isLoading && winners.length === 0) {
    return (
      <div className="flex flex-col gap-5">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <div
              key={i}
              className="h-[7.5rem] animate-pulse rounded-xl border border-neutral-200 bg-neutral-100/70"
            />
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-6">
      {kpis.length > 0 ? (
        <InsightsKpiStrip kpis={kpis} isLoading={isLoading} />
      ) : null}

      <div>
        <h2 className="mb-3 text-sm font-semibold text-foreground">
          Winners this period
        </h2>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {winners.map((item) => (
            <WinnerCard key={item.id} item={item} />
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        {boards.map((board) => (
          <div
            key={board.id}
            className={cn(
              board.id === "location" || board.id === "timing"
                ? "xl:col-span-2"
                : undefined
            )}
          >
            <BoardCard board={board} />
          </div>
        ))}
      </div>

      <section className="rounded-xl border border-neutral-200 bg-white p-4 shadow-xs">
        <h2 className="text-sm font-semibold text-foreground">
          What to do next
        </h2>
        <ul className="mt-3 list-disc space-y-2 pl-5 text-sm text-neutral-700">
          {actions.length > 0 ? (
            actions.map((action) => <li key={action}>{action}</li>)
          ) : (
            <li>
              Collect more leads in this date range to unlock clear
              recommendations.
            </li>
          )}
        </ul>
      </section>
    </div>
  )
}
