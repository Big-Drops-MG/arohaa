"use client"

import { Lock } from "lucide-react"
import { DataExportDashboard } from "@/features/data-export/view/DataExportDashboard"
import type { DataExportDashboardData } from "@/features/data-export/model/data-export"
import { getDataExportEmptyDashboardData } from "@/features/data-export/controller/data-export-empty-data"

type DataLabLeadsPanelProps = {
  projectId: string
  canAccess: boolean
  data: DataExportDashboardData | null
  isLoading: boolean
  isActive: boolean
  onDataChange?: (data: DataExportDashboardData) => void
  leadFilter?: "all" | "returning"
  title?: string
}

export function DataLabLeadsPanel({
  projectId,
  canAccess,
  data,
  isLoading,
  isActive,
  onDataChange,
  leadFilter = "all",
  title,
}: DataLabLeadsPanelProps) {
  const isRetention = leadFilter === "returning"
  const restrictedLabel = isRetention ? "Retention" : "Leads table"

  if (!canAccess) {
    return (
      <div className="flex min-h-[240px] flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-neutral-200 bg-neutral-50 px-6 text-center">
        <Lock className="size-5 text-neutral-400" aria-hidden />
        <div>
          <p className="text-sm font-medium text-foreground">
            {restrictedLabel} is restricted
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
      data={
        data ?? {
          ...getDataExportEmptyDashboardData("7d"),
          analyticsUnavailable: true,
        }
      }
      projectId={projectId}
      isActive={isActive}
      isLoading={isLoading}
      embedded
      leadFilter={leadFilter}
      title={title ?? (isRetention ? "Retention" : "Captured leads")}
      onDataChange={onDataChange}
    />
  )
}
