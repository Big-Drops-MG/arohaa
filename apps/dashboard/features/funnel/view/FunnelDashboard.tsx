"use client"

import { useState } from "react"
import type { OverviewDateRangeId } from "@/features/overview/model/overview"
import { OverviewHeader } from "@/features/overview/view/OverviewHeader"
import type { FunnelDashboardData } from "@/features/funnel/model/funnel"
import { FunnelDropOffCard } from "@/features/funnel/view/FunnelDropOffCard"
import { FunnelKpiRow } from "@/features/funnel/view/FunnelKpiRow"
import { FunnelMultiStepCard } from "@/features/funnel/view/FunnelMultiStepCard"

type FunnelDashboardProps = {
  data: FunnelDashboardData
}

export function FunnelDashboard({ data }: FunnelDashboardProps) {
  const [dateRangeId, setDateRangeId] = useState<OverviewDateRangeId>(
    data.defaultDateRangeId
  )

  return (
    <div className="flex flex-col gap-4 bg-neutral-50 px-6 pb-6 lg:px-8">
      <OverviewHeader
        title="Funnel"
        dateRangeOptions={data.dateRangeOptions}
        dateRangeId={dateRangeId}
        onDateRangeChange={setDateRangeId}
      />

      <FunnelKpiRow metrics={data.metrics} />

      <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,2fr)] items-stretch gap-4">
        <FunnelMultiStepCard steps={data.multiStepSteps} />
        <FunnelDropOffCard rows={data.dropOffRows} />
      </div>
    </div>
  )
}
