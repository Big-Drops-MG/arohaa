"use client"

import { useMemo, useState } from "react"
import type {
  OverviewDashboardData,
  OverviewDateRangeId,
} from "@/features/overview/model/overview"
import { OverviewHeader } from "@/features/overview/view/OverviewHeader"
import { experimentsForDateRange } from "@/features/experiments/utils/experiments-for-range"
import { ExperimentsCards } from "@/features/experiments/view/ExperimentsCards"

type ExperimentsDashboardProps = {
  data: OverviewDashboardData
}

export function ExperimentsDashboard({ data }: ExperimentsDashboardProps) {
  const [dateRangeId, setDateRangeId] = useState<OverviewDateRangeId>(
    data.defaultDateRangeId
  )

  const tables = useMemo(
    () => experimentsForDateRange(data, dateRangeId),
    [data, dateRangeId]
  )

  return (
    <div className="flex flex-col gap-4 px-4 sm:px-6 lg:px-8">
      <OverviewHeader
        title="Experiments"
        dateRangeOptions={data.dateRangeOptions}
        dateRangeId={dateRangeId}
        onDateRangeChange={setDateRangeId}
      />

      <ExperimentsCards tables={tables} />
    </div>
  )
}
