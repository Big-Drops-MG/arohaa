"use client"

import { useCallback, useEffect, useState } from "react"
import { AnimatePresence, motion, useReducedMotion } from "motion/react"
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@workspace/ui/components/tabs"
import { OverviewHeader } from "@/features/overview/view/OverviewHeader"
import {
  INSIGHT_SECTIONS,
  parseInsightSection,
  type InsightSectionId,
} from "@/features/insights/model/insights-section"
import type { InsightsSectionPayload } from "@/features/insights/model/insights"
import {
  insightsPanelSwap,
  insightsShellEnter,
} from "@/features/insights/model/insights-motion"
import { InsightsSectionPanel } from "@/features/insights/view/InsightsSectionPanel"
import { useDashboardDateRange } from "@/hooks/use-dashboard-date-range"
import { useDashboardUtmFilter } from "@/hooks/use-dashboard-utm-filter"
import { useDashboardSegmentFilter } from "@/hooks/use-dashboard-segment-filter"
import { useDashboardQueryParam } from "@/hooks/use-dashboard-query-param"
import { TRAFFIC_DATE_RANGE_OPTIONS } from "@/features/traffic/model/traffic-range"
import { buildAnalyticsApiPath } from "@/lib/dashboard/analytics-query"

type InsightsDashboardProps = {
  projectId: string
  isActive?: boolean
}

export function InsightsDashboard({
  projectId,
  isActive = true,
}: InsightsDashboardProps) {
  const reduceMotion = useReducedMotion()
  const { dateRangeId, customRange, setDateRangeId, setCustomRange } =
    useDashboardDateRange()
  const { utmFilter } = useDashboardUtmFilter()
  const { segmentId } = useDashboardSegmentFilter()

  const [section, setSection] = useDashboardQueryParam("insight_section", {
    parse: parseInsightSection,
    projectId,
    omitDefault: true,
    refreshOnChange: false,
  })

  const [payload, setPayload] = useState<InsightsSectionPayload | null>(null)
  const [loading, setLoading] = useState(false)
  const [fetchKey, setFetchKey] = useState("")

  const loadSection = useCallback(
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

  useEffect(() => {
    if (!isActive) return
    const controller = new AbortController()
    setLoading(true)
    setPayload(null)
    void loadSection(section, controller.signal)
      .then((data) => {
        if (controller.signal.aborted) return
        setPayload(data)
        setFetchKey(
          `${section}:${dateRangeId}:${customRange?.from ?? ""}:${customRange?.to ?? ""}:${segmentId ?? ""}`
        )
      })
      .catch((err) => {
        if (controller.signal.aborted) return
        console.error("[insights] fetch failed", err)
        setPayload({ section, kpis: [], charts: [] })
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false)
      })
    return () => controller.abort()
  }, [
    isActive,
    section,
    loadSection,
    dateRangeId,
    customRange?.from,
    customRange?.to,
    segmentId,
  ])

  return (
    <motion.div
      className="flex flex-col gap-5 px-4 pt-5 sm:px-6"
      variants={insightsShellEnter}
      initial={reduceMotion ? false : "hidden"}
      animate="visible"
    >
      <OverviewHeader
        title="Data Insights"
        projectId={projectId}
        dateRangeOptions={TRAFFIC_DATE_RANGE_OPTIONS}
        dateRangeId={dateRangeId}
        customRange={customRange}
        onDateRangeChange={setDateRangeId}
        onCustomRangeChange={setCustomRange}
        helpContent="Trend charts for volume, sources, time, age, drop-off, device, geo, risk, vehicle, quality, and experiments."
      />

      <Tabs
        value={section}
        onValueChange={(value) => setSection(parseInsightSection(value))}
        className="w-full"
      >
        <TabsList className="flex h-auto min-h-10 w-full flex-wrap justify-start gap-1 rounded-lg border border-neutral-200 bg-neutral-50 p-1">
          {INSIGHT_SECTIONS.map((tab) => (
            <TabsTrigger
              key={tab.id}
              value={tab.id}
              className="rounded-md px-2.5 py-1.5 text-xs data-[state=active]:bg-white data-[state=active]:shadow-sm sm:text-sm"
            >
              {tab.label}
            </TabsTrigger>
          ))}
        </TabsList>

        {INSIGHT_SECTIONS.map((tab) => (
          <TabsContent
            key={tab.id}
            value={tab.id}
            className="mt-5 outline-none"
          >
            {section === tab.id ? (
              <AnimatePresence mode="wait">
                <motion.div
                  key={tab.id}
                  variants={insightsPanelSwap}
                  initial={reduceMotion ? false : "initial"}
                  animate="animate"
                  exit={reduceMotion ? undefined : "exit"}
                >
                  <InsightsSectionPanel
                    data={payload?.section === tab.id ? payload : null}
                    isLoading={loading}
                    animateKey={fetchKey}
                  />
                </motion.div>
              </AnimatePresence>
            ) : null}
          </TabsContent>
        ))}
      </Tabs>
    </motion.div>
  )
}
