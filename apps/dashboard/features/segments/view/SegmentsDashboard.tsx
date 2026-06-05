"use client"

import { useMemo, useState } from "react"
import type {
  OverviewDashboardData,
  OverviewDateRangeId,
} from "@/features/overview/model/overview"
import { OverviewHeader } from "@/features/overview/view/OverviewHeader"
import { segmentPerformanceForDateRange } from "@/features/segments/utils/segment-performance-for-range"
import { segmentKpisForDateRange } from "@/features/segments/utils/segments-stat-row"
import { SegmentsPerformanceCards } from "@/features/segments/view/SegmentsPerformanceCards"
import { SegmentsStatRow } from "@/features/segments/view/SegmentsStatRow"

type SegmentsDashboardProps = {
  data: OverviewDashboardData
}

export function SegmentsDashboard({ data }: SegmentsDashboardProps) {
  const [dateRangeId, setDateRangeId] = useState<OverviewDateRangeId>(
    data.defaultDateRangeId
  )

  const kpis = useMemo(
    () => segmentKpisForDateRange(data, dateRangeId),
    [data, dateRangeId]
  )

  const performanceTables = useMemo(
    () => segmentPerformanceForDateRange(data, dateRangeId),
    [data, dateRangeId]
  )

  return (
    <div className="flex flex-col gap-4 px-4 sm:px-6 lg:px-8">
      <OverviewHeader
        title="Segments"
        dateRangeOptions={data.dateRangeOptions}
        dateRangeId={dateRangeId}
        onDateRangeChange={setDateRangeId}
      />

      <SegmentsStatRow kpis={kpis} />

      <SegmentsPerformanceCards
        dateRangeId={dateRangeId}
        tables={performanceTables}
      />
    </div>
  )
}
