"use client"

import { useMemo, useState } from "react"
import type {
  OverviewDashboardData,
  OverviewDateRangeId,
} from "@/features/overview/model/overview"
import { OverviewHeader } from "@/features/overview/view/OverviewHeader"
import {
  eventTrackingKpiSegmentsForDateRange,
  eventTrackingSubmissionForDateRange,
} from "@/features/event-tracking/utils/event-tracking-detail-for-range"
import { eventTrackingPieSegmentsFromKpis } from "@/features/event-tracking/utils/event-tracking-pie-segments"
import { eventTrackingKpisForDateRange } from "@/features/event-tracking/utils/event-tracking-stat-row"
import { EventTrackingKpiPerformanceCard } from "@/features/event-tracking/view/EventTrackingKpiPerformanceCard"
import { EventTrackingStatRow } from "@/features/event-tracking/view/EventTrackingStatRow"
import { EventTrackingSubmissionOverTimeCard } from "@/features/event-tracking/view/EventTrackingSubmissionOverTimeCard"

type EventTrackingDashboardProps = {
  data: OverviewDashboardData
}

export function EventTrackingDashboard({ data }: EventTrackingDashboardProps) {
  const [dateRangeId, setDateRangeId] = useState<OverviewDateRangeId>(
    data.defaultDateRangeId
  )

  const kpis = useMemo(
    () => eventTrackingKpisForDateRange(data, dateRangeId),
    [data, dateRangeId]
  )

  const submissionRows = useMemo(
    () => eventTrackingSubmissionForDateRange(data, dateRangeId),
    [data, dateRangeId]
  )

  const fallbackSegments = useMemo(
    () => eventTrackingKpiSegmentsForDateRange(data, dateRangeId),
    [data, dateRangeId]
  )

  const pieSegments = useMemo(
    () =>
      eventTrackingPieSegmentsFromKpis(data.formType, kpis, fallbackSegments),
    [data.formType, kpis, fallbackSegments]
  )

  return (
    <div className="flex flex-col gap-4 px-4 sm:px-6 lg:px-8">
      <OverviewHeader
        title="Event Tracking"
        dateRangeOptions={data.dateRangeOptions}
        dateRangeId={dateRangeId}
        onDateRangeChange={setDateRangeId}
      />

      <EventTrackingStatRow kpis={kpis} />

      <div className="grid gap-4 lg:grid-cols-2 lg:items-start">
        <EventTrackingSubmissionOverTimeCard
          formType={data.formType}
          rows={submissionRows}
        />
        <EventTrackingKpiPerformanceCard
          key={dateRangeId}
          formType={data.formType}
          segments={pieSegments}
        />
      </div>
    </div>
  )
}
