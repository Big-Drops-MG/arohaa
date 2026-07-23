"use client"

import {
  experimentHighlightForTables,
  type ExperimentsDashboardData,
} from "@/features/experiments/model/experiments"
import { experimentsSectionToBreakdownTable } from "@/features/experiments/utils/experiments-section-to-table"
import {
  parseTrafficNumericValue,
  sortTrafficTableRows,
  sortTrafficTableRowsByMaxRate,
} from "@/features/traffic/utils/sort-traffic-table-rows"
import { ExperimentsTableCard } from "@/features/experiments/view/ExperimentsTableCard"
import { EXPERIMENTS_PREVIEW_ROW_LIMIT } from "@/features/experiments/view/experiments-card-layout"

type ExperimentsCardsProps = {
  data: ExperimentsDashboardData
}

function winningVariantIdFromPerformance(
  data: ExperimentsDashboardData
): string | null {
  if (data.controlVariant) {
    let bestId: string | null = null
    let bestLift = -Infinity
    for (const row of data.variantPerformance.rows) {
      const label = row.variant?.trim()
      if (!label || label === data.controlVariant) continue
      const lift = parseTrafficNumericValue(row.fsrLift ?? "")
      if (lift > bestLift) {
        bestLift = lift
        bestId = label.toLowerCase().replace(/\s+/g, "-")
      }
    }
    if (bestId && bestLift > 0) return bestId
  }

  let bestId: string | null = null
  let bestRate = -1

  for (const row of data.variantPerformance.rows) {
    const rate = parseTrafficNumericValue(row.fsr)
    const label = row.variant?.trim()
    if (!label) continue

    const id = label.toLowerCase().replace(/\s+/g, "-")
    if (rate > bestRate) {
      bestRate = rate
      bestId = id
    }
  }

  return bestId
}

export function ExperimentsCards({ data }: ExperimentsCardsProps) {
  const variantPerformance = sortTrafficTableRows(
    experimentsSectionToBreakdownTable(data.variantPerformance)
  )
  const performanceByLocation = sortTrafficTableRowsByMaxRate(
    experimentsSectionToBreakdownTable(data.performanceByLocation)
  )
  const performanceByState = sortTrafficTableRowsByMaxRate(
    experimentsSectionToBreakdownTable(data.performanceByState)
  )
  const performanceByZipcode = sortTrafficTableRowsByMaxRate(
    experimentsSectionToBreakdownTable(data.performanceByZipcode)
  )

  const highlights = experimentHighlightForTables({
    winningVariantId: winningVariantIdFromPerformance(data),
  })

  return (
    <div className="flex flex-col gap-4">
      {data.winnerCallout ? (
        <div className="rounded-lg border border-border bg-neutral-50 px-4 py-3 text-sm text-foreground">
          <span className="font-medium">Winner: </span>
          {data.winnerCallout}
          {data.mode === "multi_domain" ? (
            <span className="mt-1 block text-xs text-muted-foreground">
              Comparing linked landing pages across domains.
            </span>
          ) : null}
        </div>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-2 lg:items-stretch lg:*:min-h-0">
        <ExperimentsTableCard
          title={data.variantPerformance.title}
          table={variantPerformance}
          highlight={highlights.variantPerformance}
          expandable
          previewRowLimit={EXPERIMENTS_PREVIEW_ROW_LIMIT}
        />
        <ExperimentsTableCard
          title={data.performanceByLocation.title}
          table={performanceByLocation}
          highlight={highlights.performanceByLocation}
          expandable
          previewRowLimit={EXPERIMENTS_PREVIEW_ROW_LIMIT}
        />
        <ExperimentsTableCard
          title={data.performanceByState.title}
          table={performanceByState}
          highlight={highlights.performanceByState}
          expandable
          previewRowLimit={EXPERIMENTS_PREVIEW_ROW_LIMIT}
        />
        <ExperimentsTableCard
          title={data.performanceByZipcode.title}
          table={performanceByZipcode}
          highlight={highlights.performanceByZipcode}
          expandable
          previewRowLimit={EXPERIMENTS_PREVIEW_ROW_LIMIT}
        />
      </div>
    </div>
  )
}
