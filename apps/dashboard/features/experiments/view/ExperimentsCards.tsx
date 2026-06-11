"use client"

import { experimentHighlightForTables } from "@/features/experiments/model/experiments"
import type { ExperimentsTabTables } from "@/features/experiments/model/experiments"
import { ExperimentsTableCard } from "@/features/experiments/view/ExperimentsTableCard"
import { EXPERIMENTS_LOCATION_PREVIEW_ROW_LIMIT } from "@/features/experiments/view/experiments-card-layout"

type ExperimentsCardsProps = {
  tables: ExperimentsTabTables
}

export function ExperimentsCards({ tables }: ExperimentsCardsProps) {
  const highlights = experimentHighlightForTables(tables)

  return (
    <div className="grid gap-4 lg:grid-cols-2 lg:items-stretch">
      <ExperimentsTableCard
        title="Variant Performance"
        table={tables.variantPerformance}
        highlight={highlights.variantPerformance}
      />
      <ExperimentsTableCard
        title="Performance by Location"
        table={tables.performanceByLocation}
        highlight={highlights.performanceByLocation}
        expandable
        previewRowLimit={EXPERIMENTS_LOCATION_PREVIEW_ROW_LIMIT}
      />
    </div>
  )
}
