"use client"

import { Lock } from "lucide-react"
import { DataExportDashboard } from "@/features/data-export/view/DataExportDashboard"
import type { DataExportDashboardData } from "@/features/data-export/model/data-export"
import { getDataExportEmptyDashboardData } from "@/features/data-export/controller/data-export-empty-data"
import { useDashboardDateRange } from "@/hooks/use-dashboard-date-range"

type DataLabLeadsPanelProps = {
  projectId: string
  canAccess: boolean
  data: DataExportDashboardData | null
  isLoading: boolean
  isActive: boolean
  onDataChange?: (data: DataExportDashboardData) => void
}

export function DataLabLeadsPanel({
  projectId,
  canAccess,
  data,
  isLoading,
  isActive,
  onDataChange,
}: DataLabLeadsPanelProps) {
  const { dateRangeId } = useDashboardDateRange()

  if (!canAccess) {
    return (
      <div className="flex min-h-[240px] flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-neutral-200 bg-neutral-50 px-6 text-center">
        <Lock className="size-5 text-neutral-400" aria-hidden />
        <div>
          <p className="text-sm font-medium text-foreground">
            Leads table is restricted
          </p>
          <p className="mt-1 max-w-md text-sm text-muted-foreground">
            Raw lead rows and CSV export are only available to approved
            operators.
          </p>
        </div>
      </div>
    )
  }

  return (
    <DataExportDashboard
      data={data ?? getDataExportEmptyDashboardData(dateRangeId)}
      projectId={projectId}
      isActive={isActive}
      isLoading={isLoading}
      embedded
      onDataChange={onDataChange}
    />
  )
}
