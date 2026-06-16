"use client"

import type { SegmentsDashboardData } from "@/features/segments/model/segments"
import { segmentsSectionToBreakdownTable } from "@/features/segments/utils/segments-section-to-table"
import { SegmentsPerformanceBreakdownCard } from "@/features/segments/view/SegmentsPerformanceBreakdownCard"
import { SEGMENTS_PREVIEW_ROW_LIMIT } from "@/features/segments/view/segments-performance-card-layout"

type SegmentsPerformanceCardsProps = {
  data: SegmentsDashboardData
}

export function SegmentsPerformanceCards({
  data,
}: SegmentsPerformanceCardsProps) {
  const byLocation = segmentsSectionToBreakdownTable(data.performanceByLocation)
  const byDevice = segmentsSectionToBreakdownTable(data.performanceByDevice)
  const byTime = segmentsSectionToBreakdownTable(data.performanceByTime)

  return (
    <div className="flex flex-col gap-4">
      <div className="grid gap-4 lg:grid-cols-2 lg:items-stretch lg:*:min-h-0">
        <SegmentsPerformanceBreakdownCard
          title={data.performanceByLocation.title}
          table={byLocation}
          expandable
          previewRowLimit={SEGMENTS_PREVIEW_ROW_LIMIT}
        />
        <SegmentsPerformanceBreakdownCard
          title={data.performanceByTime.title}
          table={byTime}
          expandable
          previewRowLimit={SEGMENTS_PREVIEW_ROW_LIMIT}
          sortByColumnId=""
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-2 lg:items-stretch lg:*:min-h-0">
        <div className="lg:col-span-2">
          <SegmentsPerformanceBreakdownCard
            title={data.performanceByDevice.title}
            table={byDevice}
            expandable
            previewRowLimit={SEGMENTS_PREVIEW_ROW_LIMIT}
          />
        </div>
      </div>
    </div>
  )
}
