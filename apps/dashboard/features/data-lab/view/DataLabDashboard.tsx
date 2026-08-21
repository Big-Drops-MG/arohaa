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
  parseDataLabSection,
  type DataLabSectionId,
} from "@/features/data-lab/model/data-lab-sections"
import type { IntelligenceCenterPayload } from "@/features/data-lab/model/intelligence"
import { IntelligenceCenter } from "@/features/data-lab/view/IntelligenceCenter"
import { DataLabInsightPanel } from "@/features/data-lab/view/DataLabInsightPanel"
import { DataLabLeadsPanel } from "@/features/data-lab/view/DataLabLeadsPanel"
import type { DataExportDashboardData } from "@/features/data-export/model/data-export"
import { getDataExportEmptyDashboardData } from "@/features/data-export/controller/data-export-empty-data"
import type { InsightsSectionPayload } from "@/features/insights/model/insights"
import { emptyInsightsSection } from "@/features/insights/model/insights"
import type { InsightSectionId } from "@/features/insights/model/insights-section"
import { OverviewHeader } from "@/features/overview/view/OverviewHeader"
import { TRAFFIC_DATE_RANGE_OPTIONS } from "@/features/traffic/model/traffic-range"
import { useDashboardDateRange } from "@/hooks/use-dashboard-date-range"
import { useDashboardSegmentFilter } from "@/hooks/use-dashboard-segment-filter"
import { useDashboardUtmFilter } from "@/hooks/use-dashboard-utm-filter"
import { useDashboardNavigation } from "@/hooks/use-dashboard-navigation"
import { useDashboardQueryParam } from "@/hooks/use-dashboard-query-param"
import { buildAnalyticsApiPath } from "@/lib/dashboard/analytics-query"

type DataLabDashboardProps = {
  projectId: string
  isActive?: boolean
  canAccessDataExport: boolean
  allowedSections?: string[] | null
  initialDataExport?: DataExportDashboardData | null
}

function insightSectionsForLab(lab: DataLabSectionId): InsightSectionId[] {
  switch (lab) {
    case "intelligence":
      return ["intelligence"]
    case "glance":
      return ["volume"]
    case "sources":
      return ["source"]
    case "journey":
      return ["dropoff"]
    case "quality":
      return ["quality", "risk", "vehicle"]
    case "tests":
      return ["experiment"]
    default:
      return []
  }
}

function parseLabWithLegacy(
  value: string | null,
  legacyTabHint?: string | null
): DataLabSectionId {
  if (value) return parseDataLabSection(value)
  if (legacyTabHint === "data-export") return "leads"
  if (legacyTabHint === "insights") return "intelligence"
  return "intelligence"
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
  const { utmFilter } = useDashboardUtmFilter()
  const { segmentId } = useDashboardSegmentFilter()
  const { searchParams } = useDashboardNavigation()

  const visibleSections = useMemo(() => {
    if (!allowedSections || allowedSections.length === 0) {
      return DATA_LAB_SECTIONS
    }
    const allowed = new Set(allowedSections)
    const filtered = DATA_LAB_SECTIONS.filter((s) => allowed.has(s.id))
    return filtered.length > 0 ? filtered : DATA_LAB_SECTIONS
  }, [allowedSections])

  const [labSection, setLabSection] = useDashboardQueryParam("lab", {
    parse: (raw) => {
      const parsed = parseLabWithLegacy(raw, searchParams.get("tab"))
      if (
        allowedSections &&
        allowedSections.length > 0 &&
        !allowedSections.includes(parsed)
      ) {
        return (visibleSections[0]?.id ?? "intelligence") as DataLabSectionId
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

  const [insightPayload, setInsightPayload] =
    useState<InsightsSectionPayload | null>(null)
  const [insightLoading, setInsightLoading] = useState(false)
  const [fetchKey, setFetchKey] = useState("")

  const [exportData, setExportData] = useState<DataExportDashboardData | null>(
    initialDataExport
  )
  const [exportLoading, setExportLoading] = useState(false)

  const loadInsight = useCallback(
    async (sectionId: InsightSectionId, signal?: AbortSignal) => {
      const path = buildAnalyticsApiPath(
        `/api/landing-pages/${encodeURIComponent(projectId)}/insights`,
        {
          rangeId: dateRangeId,
          customRange,
          utmFilter,
          segmentId,
          extra: { section: sectionId },
        }
      )
      const res = await fetch(path, { cache: "no-store", signal })
      if (!res.ok) throw new Error(`insights ${res.status}`)
      return (await res.json()) as InsightsSectionPayload
    },
    [projectId, dateRangeId, customRange, utmFilter, segmentId]
  )

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
    if (!isActive) return
    const sectionIds = insightSectionsForLab(labSection)
    if (sectionIds.length === 0) {
      setInsightPayload(null)
      return
    }

    const controller = new AbortController()
    setInsightLoading(true)
    setInsightPayload(null)
    void Promise.all(sectionIds.map((id) => loadInsight(id, controller.signal)))
      .then((payloads) => {
        if (controller.signal.aborted) return
        const primary = payloads[0]!
        const merged: InsightsSectionPayload = {
          ...primary,
          kpis: payloads.flatMap((p) => p.kpis),
          charts: payloads.flatMap((p) => p.charts),
          winners: primary.winners,
          boards: primary.boards,
          actions: primary.actions,
        }
        setInsightPayload(merged)
        setFetchKey(
          `${sectionIds.join("+")}:${dateRangeId}:${customRange?.from ?? ""}:${customRange?.to ?? ""}:${segmentId ?? ""}`
        )
      })
      .catch((err) => {
        if (controller.signal.aborted) return
        console.error("[data-lab] insight fetch failed", err)
        setInsightPayload(emptyInsightsSection(sectionIds[0]!))
      })
      .finally(() => {
        if (!controller.signal.aborted) setInsightLoading(false)
      })

    return () => controller.abort()
  }, [
    isActive,
    labSection,
    loadInsight,
    dateRangeId,
    customRange?.from,
    customRange?.to,
    segmentId,
  ])

  useEffect(() => {
    if (!isActive || labSection !== "leads" || !canAccessDataExport) return

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
  }, [isActive, labSection, canAccessDataExport, loadExport, dateRangeId])

  const intelligenceData: IntelligenceCenterPayload | null =
    insightPayload?.section === "intelligence"
      ? {
          section: "intelligence",
          winners: insightPayload.winners ?? [],
          boards: insightPayload.boards ?? [],
          actions: insightPayload.actions ?? [],
        }
      : null

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
        <TabsList className="h-auto min-h-10 w-full justify-start gap-5 overflow-x-auto rounded-none border-0 border-b border-neutral-200 bg-transparent p-0">
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

        <TabsContent value="intelligence" className="mt-5 outline-none">
          {labSection === "intelligence" ? (
            <IntelligenceCenter
              data={intelligenceData}
              kpis={insightPayload?.kpis ?? []}
              isLoading={insightLoading}
            />
          ) : null}
        </TabsContent>

        <TabsContent value="glance" className="mt-5 outline-none">
          {labSection === "glance" ? (
            <DataLabInsightPanel
              data={insightPayload}
              isLoading={insightLoading}
              animateKey={fetchKey}
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
            />
          ) : null}
        </TabsContent>

        <TabsContent value="sources" className="mt-5 outline-none">
          {labSection === "sources" ? (
            <DataLabInsightPanel
              data={insightPayload}
              isLoading={insightLoading}
              animateKey={fetchKey}
            />
          ) : null}
        </TabsContent>

        <TabsContent value="journey" className="mt-5 outline-none">
          {labSection === "journey" ? (
            <DataLabInsightPanel
              data={insightPayload}
              isLoading={insightLoading}
              animateKey={fetchKey}
            />
          ) : null}
        </TabsContent>

        <TabsContent value="quality" className="mt-5 outline-none">
          {labSection === "quality" ? (
            <DataLabInsightPanel
              data={insightPayload}
              isLoading={insightLoading}
              animateKey={fetchKey}
            />
          ) : null}
        </TabsContent>

        <TabsContent value="tests" className="mt-5 outline-none">
          {labSection === "tests" ? (
            <DataLabInsightPanel
              data={insightPayload}
              isLoading={insightLoading}
              animateKey={fetchKey}
            />
          ) : null}
        </TabsContent>
      </Tabs>
    </div>
  )
}
