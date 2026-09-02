"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@workspace/ui/components/tabs"
import {
  DATA_LAB_SECTIONS,
  mapLegacyInsightSectionToDataLab,
  normalizeDataLabSectionId,
  parseDataLabSection,
  type DataLabSectionId,
} from "@/features/data-lab/model/data-lab-sections"
import { emptyLevel1Stats } from "@/features/data-lab/model/level1"
import { fetchLevel1StatsFromLeadsTable } from "@/features/data-lab/model/level1-from-leads"
import { Level1Panel } from "@/features/data-lab/view/Level1Panel"
import { DataLabLeadsPanel } from "@/features/data-lab/view/DataLabLeadsPanel"
import type { DataExportDashboardData } from "@/features/data-export/model/data-export"
import { getDataExportEmptyDashboardData } from "@/features/data-export/controller/data-export-empty-data"
import { OverviewHeader } from "@/features/overview/view/OverviewHeader"
import { TRAFFIC_DATE_RANGE_OPTIONS } from "@/features/traffic/model/traffic-range"
import { useDashboardDateRange } from "@/hooks/use-dashboard-date-range"
import { useDashboardNavigation } from "@/hooks/use-dashboard-navigation"
import { useDashboardQueryParam } from "@/hooks/use-dashboard-query-param"
import { buildAnalyticsApiPath } from "@/lib/dashboard/analytics-query"
import type { Level1Stat } from "@/features/data-lab/model/level1"

type DataLabDashboardProps = {
  projectId: string
  isActive?: boolean
  canAccessDataExport: boolean
  allowedSections?: string[] | null
  initialDataExport?: DataExportDashboardData | null
}

function parseLabWithLegacy(
  value: string | null,
  legacyTabHint?: string | null
): DataLabSectionId {
  if (value) return parseDataLabSection(value)
  if (legacyTabHint === "data-export") return "leads"
  if (legacyTabHint === "insights") return "level-1"
  return "level-1"
}

export function DataLabDashboard({
  projectId,
  isActive = true,
  canAccessDataExport,
  allowedSections = null,
  initialDataExport = null,
}: DataLabDashboardProps) {
  const { dateRangeId, customRange, setDateRangeId, setCustomRange } =
    useDashboardDateRange()
  const { searchParams } = useDashboardNavigation()

  const visibleSections = useMemo(() => {
    if (!allowedSections || allowedSections.length === 0) {
      return DATA_LAB_SECTIONS
    }
    const allowed = new Set(
      allowedSections.map((section) => normalizeDataLabSectionId(section))
    )
    const filtered = DATA_LAB_SECTIONS.filter((s) => allowed.has(s.id))
    return filtered.length > 0 ? filtered : DATA_LAB_SECTIONS
  }, [allowedSections])

  const [labSection, setLabSection] = useDashboardQueryParam("lab", {
    parse: (raw) => {
      const parsed = parseLabWithLegacy(raw, searchParams.get("tab"))
      if (
        allowedSections &&
        allowedSections.length > 0 &&
        !allowedSections
          .map((section) => normalizeDataLabSectionId(section))
          .includes(parsed)
      ) {
        return (visibleSections[0]?.id ?? "level-1") as DataLabSectionId
      }
      return parsed
    },
    projectId,
    omitDefault: true,
    refreshOnChange: false,
  })

  useEffect(() => {
    const insightSection = searchParams.get("insight_section")
    if (!insightSection) return
    if (searchParams.get("lab")) return
    setLabSection(mapLegacyInsightSectionToDataLab(insightSection))
  }, [searchParams, setLabSection])

  const [exportData, setExportData] = useState<DataExportDashboardData | null>(
    initialDataExport
  )
  const [exportLoading, setExportLoading] = useState(false)

  const [level1Stats, setLevel1Stats] = useState<Level1Stat[]>(() =>
    initialDataExport?.level1Stats?.[0]?.enoughData
      ? initialDataExport.level1Stats
      : emptyLevel1Stats()
  )
  const [level1Loading, setLevel1Loading] = useState(false)

  const loadExport = useCallback(
    async (signal?: AbortSignal) => {
      const path = buildAnalyticsApiPath(
        `/api/landing-pages/${encodeURIComponent(projectId)}/data-export`,
        { rangeId: dateRangeId, customRange }
      )
      const res = await fetch(path, { cache: "no-store", signal })
      if (!res.ok) throw new Error(`data-export ${res.status}`)
      return (await res.json()) as DataExportDashboardData
    },
    [projectId, dateRangeId, customRange]
  )

  useEffect(() => {
    if (!isActive || !canAccessDataExport) return

    const controller = new AbortController()
    setExportLoading(true)
    void loadExport(controller.signal)
      .then((payload) => {
        if (controller.signal.aborted) return
        setExportData(payload)
      })
      .catch((err) => {
        if (controller.signal.aborted) return
        console.error("[data-lab] export fetch failed", err)
        setExportData(getDataExportEmptyDashboardData(dateRangeId))
      })
      .finally(() => {
        if (!controller.signal.aborted) setExportLoading(false)
      })

    return () => controller.abort()
  }, [isActive, canAccessDataExport, loadExport, dateRangeId, customRange])

  useEffect(() => {
    if (!isActive || !canAccessDataExport) return

    const controller = new AbortController()
    setLevel1Loading(true)
    void fetchLevel1StatsFromLeadsTable({
      projectId,
      dateRangeId,
      customRange,
      signal: controller.signal,
    })
      .then((stats) => {
        if (controller.signal.aborted) return
        setLevel1Stats(stats)
      })
      .catch((err) => {
        if (controller.signal.aborted) return
        console.error("[data-lab] level1 leads fetch failed", err)
        setLevel1Stats(emptyLevel1Stats())
      })
      .finally(() => {
        if (!controller.signal.aborted) setLevel1Loading(false)
      })

    return () => controller.abort()
  }, [isActive, canAccessDataExport, projectId, dateRangeId, customRange])

  const handleExportDataChange = useCallback(
    (data: DataExportDashboardData) => {
      setExportData(data)
    },
    []
  )

  return (
    <div className="flex flex-col gap-5 pt-5 pb-6">
      <OverviewHeader
        title="Data Lab"
        projectId={projectId}
        dateRangeOptions={TRAFFIC_DATE_RANGE_OPTIONS}
        dateRangeId={dateRangeId}
        customRange={customRange}
        onDateRangeChange={setDateRangeId}
        onCustomRangeChange={setCustomRange}
      />

      <Tabs
        value={labSection}
        onValueChange={(value) => setLabSection(parseDataLabSection(value))}
        className="w-full"
      >
        <TabsList className="h-auto min-h-10 w-full flex-wrap justify-start gap-x-5 gap-y-1 rounded-none border-0 border-b border-neutral-200 bg-transparent p-0">
          {visibleSections.map((tab) => (
            <TabsTrigger
              key={tab.id}
              value={tab.id}
              className="relative -mb-px shrink-0 rounded-none border-0 border-b-2 border-transparent bg-transparent px-0 py-2.5 text-sm font-normal text-neutral-600 shadow-none hover:text-neutral-900 data-[state=active]:border-neutral-950 data-[state=active]:bg-transparent data-[state=active]:font-semibold data-[state=active]:text-neutral-950 data-[state=active]:shadow-none"
            >
              {tab.label}
            </TabsTrigger>
          ))}
        </TabsList>

        <TabsContent value="level-1" className="mt-5 outline-none">
          {labSection === "level-1" ? (
            <Level1Panel
              stats={level1Stats}
              isLoading={level1Loading}
              canAccess={canAccessDataExport}
            />
          ) : null}
        </TabsContent>

        <TabsContent value="leads" className="mt-5 outline-none">
          {labSection === "leads" ? (
            <DataLabLeadsPanel
              projectId={projectId}
              canAccess={canAccessDataExport}
              data={exportData}
              isLoading={exportLoading}
              isActive={isActive}
              onDataChange={handleExportDataChange}
            />
          ) : null}
        </TabsContent>
      </Tabs>
    </div>
  )
}
