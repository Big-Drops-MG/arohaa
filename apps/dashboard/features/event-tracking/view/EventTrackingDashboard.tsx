"use client"

import { useState } from "react"
import type { OverviewDateRangeId } from "@/features/overview/model/overview"
import { OverviewHeader } from "@/features/overview/view/OverviewHeader"
import type { EventTrackingDashboardData } from "@/features/event-tracking/model/event-tracking"
import { EventTrackingKpiPieChart } from "@/features/event-tracking/view/EventTrackingKpiPieChart"
import { EventTrackingKpiRow } from "@/features/event-tracking/view/EventTrackingKpiRow"
import { EventTrackingSubmissionTableCard } from "@/features/event-tracking/view/EventTrackingSubmissionTableCard"

type EventTrackingDashboardProps = {
  data: EventTrackingDashboardData
}

export function EventTrackingDashboard({ data }: EventTrackingDashboardProps) {
  const [dateRangeId, setDateRangeId] = useState<OverviewDateRangeId>(
    data.defaultDateRangeId
  )

  return (
    <div className="flex flex-col gap-4 bg-neutral-50 px-6 pb-6 lg:px-8">
      <OverviewHeader
        title="Event Tracking"
        dateRangeOptions={data.dateRangeOptions}
        dateRangeId={dateRangeId}
        onDateRangeChange={setDateRangeId}
      />

      <EventTrackingKpiRow kpis={data.kpis} />

      <div className="grid grid-cols-2 items-stretch gap-4">
        <EventTrackingSubmissionTableCard rows={data.submissionRows} />
        <EventTrackingKpiPieChart segments={data.pieSegments} />
      </div>
    </div>
  )
}
