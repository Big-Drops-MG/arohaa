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
import {
  emptyLevel1Stats,
  filterLevel1StatsToVisibleLeadColumns,
  hasCompleteLevel1Stats,
  type Level1Stat,
} from "@/features/data-lab/model/level1"
import {
  emptyLevel2Stats,
  filterLevel2StatsToVisibleLeadColumns,
  type Level2Stat,
} from "@/features/data-lab/model/level2"
import {
  dataLabStatsFromExportPayload,
  fetchDataLabStatsFromLeadsTable,
} from "@/features/data-lab/model/level1-from-leads"
import { hasCompleteLevel3Stats } from "@/features/data-lab/model/level3"
import type { IntelligenceCenterPayload } from "@/features/data-lab/model/intelligence"
import { Level1Panel } from "@/features/data-lab/view/Level1Panel"
import { Level2Panel } from "@/features/data-lab/view/Level2Panel"
import { Level3Panel } from "@/features/data-lab/view/Level3Panel"
import { DataLabLeadsPanel } from "@/features/data-lab/view/DataLabLeadsPanel"
import type { DataExportDashboardData } from "@/features/data-export/model/data-export"
import { getDataExportEmptyDashboardData } from "@/features/data-export/controller/data-export-empty-data"
import { discoverVisibleLeadFieldKeys } from "@/features/data-export/model/lead-field-columns"
import { OverviewHeader } from "@/features/overview/view/OverviewHeader"
import { TRAFFIC_DATE_RANGE_OPTIONS } from "@/features/traffic/model/traffic-range"
import { useDashboardDateRange } from "@/hooks/use-dashboard-date-range"
import { useDashboardNavigation } from "@/hooks/use-dashboard-navigation"
import { useDashboardQueryParam } from "@/hooks/use-dashboard-query-param"

function emptyLevel3Data(): IntelligenceCenterPayload {
  return { section: "level3", winners: [], boards: [], actions: [] }
}

type DataLabDashboardProps = {
  projectId: string
  isActive?: boolean
  canAccessDataExport: boolean
  allowedSections?: string[] | null
  initialDataExport?: DataExportDashboardData | null
  initialDataExportLoading?: boolean
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

function seedDataLabStats(initialDataExport: DataExportDashboardData | null) {
  if (!initialDataExport) {
    return {
      level1Stats: emptyLevel1Stats(),
      level2Stats: emptyLevel2Stats(),
      level3: emptyLevel3Data(),
    }
  }
  return dataLabStatsFromExportPayload(initialDataExport)
}

function hasCompleteDataLabStats(
  data: DataExportDashboardData | null | undefined
): boolean {
  return Boolean(
    data?.level1Complete &&
    hasCompleteLevel1Stats(data.level1Stats) &&
    data.level2Complete &&
    Array.isArray(data.level2Stats) &&
    data.level3Complete &&
    hasCompleteLevel3Stats(data.level3)
  )
}

export function DataLabDashboard({
  projectId,
  isActive = true,
  canAccessDataExport,
  allowedSections = null,
  initialDataExport = null,
  initialDataExportLoading = false,
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

  const seeded = seedDataLabStats(initialDataExport)
  const [level1Stats, setLevel1Stats] = useState<Level1Stat[]>(
    () => seeded.level1Stats
  )
  const [level2Stats, setLevel2Stats] = useState<Level2Stat[]>(
    () => seeded.level2Stats
  )
  const [level3Data, setLevel3Data] = useState<IntelligenceCenterPayload>(
    () => seeded.level3
  )
  const [statsLoading, setStatsLoading] = useState(
    () =>
      canAccessDataExport &&
      (initialDataExportLoading || !hasCompleteDataLabStats(initialDataExport))
  )

  useEffect(() => {
    if (!isActive || !canAccessDataExport) return
    if (initialDataExportLoading || !initialDataExport) {
      setExportLoading(true)
      setStatsLoading(true)
      return
    }

    const payload = initialDataExport
    const controller = new AbortController()
    let cancelled = false
    setExportData(payload)
    setExportLoading(false)
    setStatsLoading(true)

    async function resolveCompleteStats() {
      try {
        if (hasCompleteDataLabStats(payload)) {
          const completeStats = dataLabStatsFromExportPayload(payload)
          setLevel1Stats(completeStats.level1Stats)
          setLevel2Stats(completeStats.level2Stats)
          setLevel3Data(completeStats.level3)
          setStatsLoading(false)
          return
        }

        const refined = await fetchDataLabStatsFromLeadsTable({
          projectId,
          dateRangeId,
          customRange,
          signal: controller.signal,
          seed: payload,
          onProgress: (progressive) => {
            if (cancelled || controller.signal.aborted) return
            setLevel1Stats(progressive.level1Stats)
            setLevel2Stats(progressive.level2Stats)
            setLevel3Data(progressive.level3)
          },
        })
        if (cancelled || controller.signal.aborted) return
        setLevel1Stats(refined.level1Stats)
        setLevel2Stats(refined.level2Stats)
        setLevel3Data(refined.level3)
        setStatsLoading(false)
      } catch (err) {
        if (cancelled || controller.signal.aborted) return
        console.error("[data-lab] load failed", err)
        setExportData(getDataExportEmptyDashboardData(dateRangeId))
        setLevel1Stats(emptyLevel1Stats())
        setLevel2Stats(emptyLevel2Stats())
        setLevel3Data(emptyLevel3Data())
      } finally {
        if (!cancelled && !controller.signal.aborted) {
          setExportLoading(false)
        }
      }
    }

    void resolveCompleteStats()

    return () => {
      cancelled = true
      controller.abort()
    }
  }, [
    isActive,
    canAccessDataExport,
    projectId,
    dateRangeId,
    customRange,
    initialDataExport,
    initialDataExportLoading,
  ])

  const cardsLoading =
    statsLoading || initialDataExportLoading || !initialDataExport
  const leadsLoading =
    exportLoading || initialDataExportLoading || !initialDataExport

  const handleExportDataChange = useCallback(
    (data: DataExportDashboardData) => {
      setExportData(data)
    },
    []
  )
  const visibleLeadFieldKeys = useMemo(
    () =>
      exportData?.visibleLeadFieldKeys.length
        ? exportData.visibleLeadFieldKeys
        : discoverVisibleLeadFieldKeys(exportData?.leads ?? []),
    [exportData?.leads, exportData?.visibleLeadFieldKeys]
  )

  const visibleLevel2Stats = useMemo(
    () =>
      filterLevel2StatsToVisibleLeadColumns(level2Stats, visibleLeadFieldKeys),
    [level2Stats, visibleLeadFieldKeys]
  )
  const visibleLevel1Stats = useMemo(
    () =>
      filterLevel1StatsToVisibleLeadColumns(level1Stats, visibleLeadFieldKeys),
    [level1Stats, visibleLeadFieldKeys]
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
              stats={visibleLevel1Stats}
              isLoading={cardsLoading}
              canAccess={canAccessDataExport}
            />
          ) : null}
        </TabsContent>

        <TabsContent value="level-2" className="mt-5 outline-none">
          {labSection === "level-2" ? (
            <Level2Panel
              stats={visibleLevel2Stats}
              isLoading={cardsLoading}
              canAccess={canAccessDataExport}
            />
          ) : null}
        </TabsContent>

        <TabsContent value="level-3" className="mt-5 outline-none">
          {labSection === "level-3" ? (
            <Level3Panel
              data={level3Data}
              isLoading={cardsLoading}
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
              isLoading={leadsLoading}
              isActive={isActive}
              onDataChange={handleExportDataChange}
            />
          ) : null}
        </TabsContent>
      </Tabs>
    </div>
  )
}
