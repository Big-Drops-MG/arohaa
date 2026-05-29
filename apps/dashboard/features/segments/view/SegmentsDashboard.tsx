"use client"

import { useState } from "react"
import type { OverviewDateRangeId } from "@/features/overview/model/overview"
import { OverviewHeader } from "@/features/overview/view/OverviewHeader"
import type { SegmentsDashboardData } from "@/features/segments/model/segments"
import { SegmentsPerformanceTableCard } from "@/features/segments/view/SegmentsPerformanceTableCard"
import { SegmentsSummaryKpiRow } from "@/features/segments/view/SegmentsSummaryKpiRow"

type SegmentsDashboardProps = {
  data: SegmentsDashboardData
}

export function SegmentsDashboard({ data }: SegmentsDashboardProps) {
  const [dateRangeId, setDateRangeId] = useState<OverviewDateRangeId>(
    data.defaultDateRangeId
  )

  return (
    <div className="flex flex-col gap-4 bg-neutral-50 px-6 pb-6 lg:px-8">
      <OverviewHeader
        title="Segments"
        dateRangeOptions={data.dateRangeOptions}
        dateRangeId={dateRangeId}
        onDateRangeChange={setDateRangeId}
      />

      <SegmentsSummaryKpiRow kpis={data.summaryKpis} />

      <div className="grid grid-cols-2 items-start gap-4">
        <div className="flex flex-col gap-4">
          <SegmentsPerformanceTableCard section={data.performanceByLocation} />
          <SegmentsPerformanceTableCard section={data.performanceByTime} />
        </div>
        <SegmentsPerformanceTableCard section={data.performanceByDevice} />
      </div>
    </div>
  )
}
