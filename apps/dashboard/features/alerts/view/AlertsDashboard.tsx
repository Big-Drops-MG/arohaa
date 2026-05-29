"use client"

import { useState } from "react"
import type { OverviewDateRangeId } from "@/features/overview/model/overview"
import { OverviewHeader } from "@/features/overview/view/OverviewHeader"
import type { AlertsDashboardData } from "@/features/alerts/model/alerts"
import { AlertsListCard } from "@/features/alerts/view/AlertsListCard"

type AlertsDashboardProps = {
  data: AlertsDashboardData
}

export function AlertsDashboard({ data }: AlertsDashboardProps) {
  const [dateRangeId, setDateRangeId] = useState<OverviewDateRangeId>(
    data.defaultDateRangeId
  )

  return (
    <div className="flex flex-col gap-4 bg-neutral-50 px-6 pb-6 lg:px-8">
      <OverviewHeader
        title="Alerts"
        dateRangeOptions={data.dateRangeOptions}
        dateRangeId={dateRangeId}
        onDateRangeChange={setDateRangeId}
      />

      <AlertsListCard items={data.items} />
    </div>
  )
}
