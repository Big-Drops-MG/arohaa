"use client"

import { useMemo, useState } from "react"
import type {
  OverviewDashboardData,
  OverviewDateRangeId,
} from "@/features/overview/model/overview"
import { OverviewHeader } from "@/features/overview/view/OverviewHeader"
import { trafficKpisForDateRange } from "@/features/traffic/utils/traffic-stat-row"
import { trafficTablesForDateRange } from "@/features/traffic/utils/traffic-tables-for-range"
import { TrafficDataTableCard } from "@/features/traffic/view/TrafficDataTableCard"
import { TrafficSourcesCard } from "@/features/traffic/view/TrafficSourcesCard"
import { TrafficStatRow } from "@/features/traffic/view/TrafficStatRow"

type TrafficDashboardProps = {
  data: OverviewDashboardData
}

export function TrafficDashboard({ data }: TrafficDashboardProps) {
  const [dateRangeId, setDateRangeId] = useState<OverviewDateRangeId>(
    data.defaultDateRangeId
  )

  const kpis = useMemo(
    () => trafficKpisForDateRange(data, dateRangeId),
    [data, dateRangeId]
  )

  const tables = useMemo(
    () => trafficTablesForDateRange(data, dateRangeId),
    [data, dateRangeId]
  )

  return (
    <div className="flex flex-col gap-4 px-4 sm:px-6 lg:px-8">
      <OverviewHeader
        title="Traffic"
        dateRangeOptions={data.dateRangeOptions}
        dateRangeId={dateRangeId}
        onDateRangeChange={setDateRangeId}
      />

      <TrafficStatRow activeUsersNow={data.activeUsersNow} kpis={kpis} />

      <div className="grid gap-4 lg:grid-cols-2 lg:items-start">
        <TrafficDataTableCard title="Traffic by Time" table={tables.byTime} />
        <TrafficDataTableCard
          title="Traffic by Location"
          table={tables.byLocation}
        />
        <TrafficDataTableCard
          title="Traffic by Device"
          table={tables.byDevice}
        />
        <TrafficSourcesCard sources={tables.sources} />
        <TrafficDataTableCard title="Top Pages" table={tables.topPages} />
      </div>
    </div>
  )
}
