"use client"

import { useState } from "react"
import type { OverviewDateRangeId } from "@/features/overview/model/overview"
import { OverviewHeader } from "@/features/overview/view/OverviewHeader"
import type { ExperimentsDashboardData } from "@/features/experiments/model/experiments"
import { ExperimentsListCard } from "@/features/experiments/view/ExperimentsListCard"
import { ExperimentsPerformanceTableCard } from "@/features/experiments/view/ExperimentsPerformanceTableCard"

type ExperimentsDashboardProps = {
  data: ExperimentsDashboardData
}

export function ExperimentsDashboard({ data }: ExperimentsDashboardProps) {
  const [dateRangeId, setDateRangeId] = useState<OverviewDateRangeId>(
    data.defaultDateRangeId
  )

  return (
    <div className="flex flex-col gap-4 bg-neutral-50 px-6 pb-6 lg:px-8">
      <OverviewHeader
        title="Experiments"
        dateRangeOptions={data.dateRangeOptions}
        dateRangeId={dateRangeId}
        onDateRangeChange={setDateRangeId}
      />

      <ExperimentsListCard experiments={data.experiments} />

      <div className="grid grid-cols-2 items-stretch gap-4">
        <ExperimentsPerformanceTableCard section={data.variantPerformance} />
        <ExperimentsPerformanceTableCard section={data.performanceByLocation} />
      </div>
    </div>
  )
}
