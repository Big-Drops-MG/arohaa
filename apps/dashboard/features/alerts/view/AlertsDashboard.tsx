"use client"

import { useMemo, useState } from "react"
import type {
  OverviewDashboardData,
  OverviewDateRangeId,
} from "@/features/overview/model/overview"
import { OverviewHeader } from "@/features/overview/view/OverviewHeader"
import {
  countAlertsBySeverity,
  emptyAlertsFilterMessage,
  filterAlertsBySeverity,
  type AlertsSeverityFilterValue,
} from "@/features/alerts/utils/alert-severity-filter"
import { alertsForDateRange } from "@/features/alerts/utils/alerts-for-range"
import { AlertsListCard } from "@/features/alerts/view/AlertsListCard"
import { AlertsSeverityFilter } from "@/features/alerts/view/AlertsSeverityFilter"

type AlertsDashboardProps = {
  data: OverviewDashboardData
}

export function AlertsDashboard({ data }: AlertsDashboardProps) {
  const [dateRangeId, setDateRangeId] = useState<OverviewDateRangeId>(
    data.defaultDateRangeId
  )
  const [severityFilter, setSeverityFilter] =
    useState<AlertsSeverityFilterValue>("all")

  const alerts = useMemo(
    () => alertsForDateRange(data, dateRangeId),
    [data, dateRangeId]
  )

  const counts = useMemo(() => countAlertsBySeverity(alerts), [alerts])

  const filteredAlerts = useMemo(
    () => filterAlertsBySeverity(alerts, severityFilter),
    [alerts, severityFilter]
  )

  return (
    <div className="flex flex-col gap-4 px-4 sm:px-6 lg:px-8">
      <OverviewHeader
        title="Alerts"
        dateRangeOptions={data.dateRangeOptions}
        dateRangeId={dateRangeId}
        onDateRangeChange={(id) => {
          setDateRangeId(id)
          setSeverityFilter("all")
        }}
      />

      <AlertsSeverityFilter
        counts={counts}
        value={severityFilter}
        onChange={setSeverityFilter}
      />

      <AlertsListCard
        alerts={filteredAlerts}
        emptyMessage={emptyAlertsFilterMessage(severityFilter)}
      />
    </div>
  )
}
