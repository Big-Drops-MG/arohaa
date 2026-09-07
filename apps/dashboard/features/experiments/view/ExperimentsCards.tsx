"use client"

import { dashboardGridTwoColClassName } from "@/features/overview/view/overview-card-density"

import {
  experimentHighlightForTables,
  type ExperimentsDashboardData,
} from "@/features/experiments/model/experiments"
import {
  experimentVariantRateColumnId,
  experimentVariantRowId,
} from "@/features/experiments/utils/experiment-table-columns"
import { experimentsSectionToBreakdownTable } from "@/features/experiments/utils/experiments-section-to-table"
import { hasConversionMetrics } from "@/features/overview/model/overview"
import {
  sortTrafficTableRows,
  sortTrafficTableRowsByMaxRate,
} from "@/features/traffic/utils/sort-traffic-table-rows"
import { ExperimentsTableCard } from "@/features/experiments/view/ExperimentsTableCard"
import { EXPERIMENTS_PREVIEW_ROW_LIMIT } from "@/features/experiments/view/experiments-card-layout"

type ExperimentsCardsProps = {
  data: ExperimentsDashboardData
}

export function ExperimentsCards({ data }: ExperimentsCardsProps) {
  const showForm = hasConversionMetrics(data.formType)
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

  const currentLabel = data.config?.currentLabel ?? null
  const highlights = experimentHighlightForTables({
    variantRowId: currentLabel ? experimentVariantRowId(currentLabel) : null,
    variantRateColumnId: currentLabel
      ? experimentVariantRateColumnId(currentLabel)
      : null,
  })

  return (
    <div className={dashboardGridTwoColClassName}>
      <ExperimentsTableCard
        title={data.variantPerformance.title}
        table={variantPerformance}
        highlight={highlights.variantPerformance}
        expandable
        previewRowLimit={EXPERIMENTS_PREVIEW_ROW_LIMIT}
      />
      {showForm ? (
        <>
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
        </>
      ) : null}
    </div>
  )
}
