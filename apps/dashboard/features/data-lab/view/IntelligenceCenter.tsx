"use client"

import { Trophy } from "lucide-react"
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

const CORE_WINNER_IDS = new Set([
  "best-converting-source",
  "best-converting-state",
  "best-converting-age-group",
  "best-converting-vehicle-make",
  "most-efficient-time-window",
  "volume-vs-efficiency-gap",
])

function shortWinnerLabel(label: string): string {
  return label
    .replace(/^Best Converting\s+/i, "")
    .replace(/^Most Efficient\s+/i, "")
    .replace(/^Largest\s+/i, "")
    .replace(/^Volume & Efficiency Leader$/i, "Volume & Efficiency")
}

function parseRateDisplay(
  secondaryValue?: string | number
): { rate: string; detail: string | null } | null {
  if (secondaryValue == null || secondaryValue === "—") return null
  const raw = String(secondaryValue).trim()
  const match = raw.match(/^([\d.]+%)\s*(?:\((.+)\))?$/)
  if (!match) return { rate: raw, detail: null }
  return { rate: match[1]!, detail: match[2] ? `(${match[2]})` : null }
}

function hasWinnerValue(item: IntelligenceWinner): boolean {
  return (
    item.value !== "—" &&
    item.value.trim().length > 0 &&
    ((typeof item.metricValue === "number" && item.metricValue > 0) ||
      (item.sampleSize ?? 0) > 0)
  )
}

function CoreWinnerCard({ item }: { item: IntelligenceWinner }) {
  const ready = hasWinnerValue(item)
  const rateInfo = parseRateDisplay(item.secondaryValue)
  const title = shortWinnerLabel(item.label)
  const isGapCard = item.metricLabel === "Gap (pp)"

  return (
    <article className="flex h-full min-h-32 flex-col rounded-xl border border-neutral-200 bg-white p-4 shadow-xs">
      <div className="flex items-start justify-between gap-2">
        <span className="inline-flex max-w-[70%] rounded-md bg-neutral-100 px-2 py-0.5 text-[11px] font-semibold tracking-wide text-neutral-600 uppercase">
          <span className="truncate">{title}</span>
        </span>
        {!item.enoughData && ready ? (
          <span className="shrink-0 rounded-md bg-amber-50 px-1.5 py-0.5 text-[10px] font-medium text-amber-700 ring-1 ring-amber-100">
            Low sample
          </span>
        ) : null}
      </div>

      {ready ? (
        <div className="mt-3 flex flex-1 items-end justify-between gap-3">
          <div className="min-w-0 flex-1">
            <p className="line-clamp-2 font-heading text-xl leading-snug font-semibold tracking-tight text-foreground">
              {item.value}
            </p>
            <p className="mt-1.5 text-xs text-muted-foreground tabular-nums">
              {isGapCard
                ? rateInfo
                  ? `Leader rate ${rateInfo.rate}${rateInfo.detail ? ` ${rateInfo.detail}` : ""}`
                  : null
                : item.metricLabel === "Submitted leads" &&
                    typeof item.metricValue === "number"
                  ? `${item.metricValue.toLocaleString()} submitted`
                  : `${item.metricLabel}: ${
                      typeof item.metricValue === "number"
                        ? item.metricValue.toLocaleString()
                        : item.metricValue
                    }`}
              {!isGapCard && rateInfo?.detail ? (
                <span className="text-neutral-400"> · {rateInfo.detail}</span>
              ) : null}
            </p>
          </div>
          {isGapCard && typeof item.metricValue === "number" ? (
            <div className="shrink-0 text-right">
              <p className="font-heading text-2xl font-semibold tracking-tight text-indigo-700 tabular-nums">
                +{item.metricValue}
              </p>
              <p className="text-[10px] font-medium tracking-wide text-indigo-700/70 uppercase">
                pp gap
              </p>
            </div>
          ) : rateInfo ? (
            <div className="shrink-0 text-right">
              <p className="font-heading text-2xl font-semibold tracking-tight text-emerald-700 tabular-nums">
                {rateInfo.rate}
              </p>
              <p className="text-[10px] font-medium tracking-wide text-emerald-700/70 uppercase">
                rate
              </p>
            </div>
          ) : null}
        </div>
      ) : (
        <p className="mt-auto pt-3 text-sm text-muted-foreground">
          Not enough data yet
        </p>
      )}
    </article>
  )
}

function ComboWinnerRow({ item }: { item: IntelligenceWinner }) {
  const ready = hasWinnerValue(item)
  const rateInfo = parseRateDisplay(item.secondaryValue)
  const title = shortWinnerLabel(item.label)

  return (
    <div
      className={cn(
        "grid grid-cols-1 items-center gap-2 border-b border-neutral-100 px-4 py-3 last:border-0 sm:grid-cols-[minmax(0,1.1fr)_minmax(0,1.4fr)_auto_auto]",
        !item.enoughData && ready && "bg-amber-50/30"
      )}
    >
      <p className="truncate text-xs font-medium text-muted-foreground">
        {title}
      </p>
      {ready ? (
        <>
          <p className="truncate text-sm font-semibold text-foreground">
            {item.value}
          </p>
          <p className="text-sm font-semibold text-emerald-700 tabular-nums sm:text-right">
            {rateInfo?.rate ?? "—"}
          </p>
          <p className="text-xs text-muted-foreground tabular-nums sm:text-right">
            {typeof item.metricValue === "number"
              ? `${item.metricValue.toLocaleString()} submitted`
              : "—"}
            {!item.enoughData ? (
              <span className="ml-2 text-amber-700">Low sample</span>
            ) : null}
          </p>
        </>
      ) : (
        <p className="text-sm text-muted-foreground sm:col-span-3">
          Not enough data yet
        </p>
      )}
    </div>
  )
}

function BoardCard({ board }: { board: IntelligenceBoard }) {
  return (
    <section className="flex h-full flex-col overflow-hidden rounded-xl border border-neutral-200 bg-white shadow-xs">
      <div className="shrink-0 border-b border-neutral-100 px-4 py-3">
        <h3 className="text-sm font-semibold text-foreground">{board.title}</h3>
      </div>
      {board.rows.length === 0 ? (
        <p className="flex flex-1 items-center justify-center px-4 py-8 text-center text-sm text-muted-foreground">
          Nothing to show in this range yet.
        </p>
      ) : (
        <>
          <div className="min-h-0 flex-1 overflow-x-auto">
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
                {board.rows.map((row, rowIndex) => (
                  <tr
                    key={`${board.id}-${row.label}`}
                    className={cn(
                      "border-b border-neutral-50 last:border-0",
                      rowIndex === 0 &&
                        "border-l-2 border-l-amber-400 bg-amber-50/40"
                    )}
                  >
                    <td
                      className={cn(
                        "px-4 py-2.5 font-medium text-foreground",
                        rowIndex === 0 && "pl-3.5"
                      )}
                    >
                      {rowIndex === 0 ? (
                        <span className="inline-flex items-center gap-1.5">
                          <Trophy
                            className="size-3 shrink-0 text-amber-500"
                            aria-hidden
                          />
                          {row.label}
                        </span>
                      ) : (
                        row.label
                      )}
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
          {board.takeaway ? (
            <div className="mt-auto shrink-0 border-t border-neutral-100 bg-neutral-50/80 px-4 py-3">
              <p className="text-xs leading-relaxed text-neutral-600">
                <span className="font-semibold text-neutral-800">
                  Takeaway:
                </span>{" "}
                {board.takeaway}
              </p>
            </div>
          ) : null}
        </>
      )}
    </section>
  )
}

function WinnersSection({ winners }: { winners: IntelligenceWinner[] }) {
  const core = winners.filter((item) => CORE_WINNER_IDS.has(item.id))
  const combos = winners.filter((item) => !CORE_WINNER_IDS.has(item.id))

  return (
    <div className="flex flex-col gap-5">
      <div>
        <div className="mb-3 flex items-end justify-between gap-3">
          <div>
            <h2 className="text-sm font-semibold text-foreground">
              Winners this period
            </h2>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Top conversion-efficiency signals for this range
            </p>
          </div>
        </div>
        <div className="grid auto-rows-fr grid-cols-1 items-stretch gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {core.map((item) => (
            <CoreWinnerCard key={item.id} item={item} />
          ))}
        </div>
      </div>

      {combos.length > 0 ? (
        <section className="overflow-hidden rounded-xl border border-neutral-200 bg-white shadow-xs">
          <div className="border-b border-neutral-100 px-4 py-3">
            <h3 className="text-sm font-semibold text-foreground">
              Best combinations
            </h3>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Highest-efficiency pairings across source, audience, geo, and
              inventory
            </p>
          </div>
          <div className="hidden border-b border-neutral-100 bg-neutral-50/80 px-4 py-2 text-[11px] font-medium tracking-wide text-muted-foreground uppercase sm:grid sm:grid-cols-[minmax(0,1.1fr)_minmax(0,1.4fr)_auto_auto] sm:gap-2">
            <span>Insight</span>
            <span>Winner</span>
            <span className="text-right">Rate</span>
            <span className="text-right">Volume</span>
          </div>
          <div>
            {combos.map((item) => (
              <ComboWinnerRow key={item.id} item={item} />
            ))}
          </div>
        </section>
      ) : null}
    </div>
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
        <div className="grid auto-rows-fr grid-cols-1 items-stretch gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div
              key={i}
              className="h-32 animate-pulse rounded-xl border border-neutral-200 bg-neutral-100/70"
            />
          ))}
        </div>
        <div className="h-48 animate-pulse rounded-xl border border-neutral-200 bg-neutral-100/70" />
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-6">
      {kpis.length > 0 ? (
        <InsightsKpiStrip kpis={kpis} isLoading={isLoading} />
      ) : null}

      <WinnersSection winners={winners} />

      <div className="grid auto-rows-fr grid-cols-1 items-stretch gap-3 xl:grid-cols-2">
        {boards.map((board) => (
          <div
            key={board.id}
            className={cn(
              "h-full",
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
        <ol className="mt-3 space-y-3">
          {(actions.length > 0
            ? actions
            : [
                "Collect more leads in this date range to unlock clear recommendations.",
              ]
          ).map((action, index) => (
            <li key={action} className="flex items-start gap-3">
              <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-indigo-50 text-xs font-semibold text-indigo-700 tabular-nums ring-1 ring-indigo-100">
                {index + 1}
              </span>
              <p className="pt-0.5 text-sm leading-relaxed text-neutral-700">
                {action}
              </p>
            </li>
          ))}
        </ol>
      </section>
    </div>
  )
}
