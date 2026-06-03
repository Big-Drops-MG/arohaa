"use client"

import { useState } from "react"
import type {
  OverviewDashboardData,
  OverviewDateRangeId,
} from "@/features/overview/model/overview"
import { OverviewHeader } from "@/features/overview/view/OverviewHeader"
import { FunnelDetailCards } from "@/features/funnel/view/FunnelDetailCards"
import { FunnelStatRow } from "@/features/funnel/view/FunnelStatRow"

type FunnelDashboardProps = {
  data: OverviewDashboardData
}

export function FunnelDashboard({ data }: FunnelDashboardProps) {
  const [dateRangeId, setDateRangeId] = useState<OverviewDateRangeId>(
    data.defaultDateRangeId
  )

  return (
    <div className="flex flex-col gap-4 px-4 sm:px-6 lg:px-8">
      <OverviewHeader
        title="Funnel"
        dateRangeOptions={data.dateRangeOptions}
        dateRangeId={dateRangeId}
        onDateRangeChange={setDateRangeId}
      />

      <FunnelStatRow steps={data.funnel} />

      <FunnelDetailCards
        formType={data.formType}
        multiStepFormTracking={data.multiStepFormTracking}
        formDropOffByField={data.formDropOffByField}
      />
    </div>
  )
}
