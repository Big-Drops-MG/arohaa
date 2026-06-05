"use client"

import type { SegmentsPerformanceTables } from "@/features/segments/model/segments-performance"
import {
  segmentPerformancePeriodTitle,
  showSegmentPerformancePeriodCard,
} from "@/features/segments/utils/segment-performance-columns"
import { SegmentsPerformanceTableCard } from "@/features/segments/view/SegmentsPerformanceTableCard"
import { SEGMENTS_LOCATION_PREVIEW_ROW_LIMIT } from "@/features/segments/view/segments-performance-card-layout"
import type { OverviewDateRangeId } from "@/features/overview/model/overview"

type SegmentsPerformanceCardsProps = {
  dateRangeId: OverviewDateRangeId
  tables: SegmentsPerformanceTables
}

export function SegmentsPerformanceCards({
  dateRangeId,
  tables,
}: SegmentsPerformanceCardsProps) {
  const periodTitle = segmentPerformancePeriodTitle(dateRangeId)
  const showPeriodCard = showSegmentPerformancePeriodCard(dateRangeId)

  return (
    <div className="flex flex-col gap-4">
      <div className="grid gap-4 lg:grid-cols-2 lg:items-stretch">
        <SegmentsPerformanceTableCard
          title="Performance by Location"
          table={tables.byLocation}
          size="compact"
          expandable
          previewRowLimit={SEGMENTS_LOCATION_PREVIEW_ROW_LIMIT}
        />
        <SegmentsPerformanceTableCard
          title="Performance by Device"
          table={tables.byDevice}
          size="compact"
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-2 lg:items-stretch">
        <SegmentsPerformanceTableCard
          title="Performance by Time"
          table={tables.byHour}
          size="tall"
          sortByColumnId=""
        />
        {showPeriodCard && periodTitle ? (
          <SegmentsPerformanceTableCard
            title={periodTitle}
            table={tables.byPeriod}
            size="tall"
            sortByColumnId=""
          />
        ) : null}
      </div>
    </div>
  )
}
