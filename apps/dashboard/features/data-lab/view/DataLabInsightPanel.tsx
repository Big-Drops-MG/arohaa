"use client"

import type { InsightsSectionPayload } from "@/features/insights/model/insights"
import { InsightsSectionPanel } from "@/features/insights/view/InsightsSectionPanel"

type DataLabInsightPanelProps = {
  data: InsightsSectionPayload | null
  isLoading: boolean
  animateKey: string
}

export function DataLabInsightPanel({
  data,
  isLoading,
  animateKey,
}: DataLabInsightPanelProps) {
  return (
    <InsightsSectionPanel
      data={data}
      isLoading={isLoading}
      animateKey={animateKey}
    />
  )
}
