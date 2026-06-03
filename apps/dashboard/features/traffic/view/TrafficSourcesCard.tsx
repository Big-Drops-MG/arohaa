"use client"

import { cn } from "@workspace/ui/lib/utils"
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@workspace/ui/components/card"
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@workspace/ui/components/tabs"
import type { TrafficSourcesData } from "@/features/traffic/model/traffic"
import { TrafficBreakdownTableView } from "@/features/traffic/view/TrafficBreakdownTableView"
import { TrafficExpandableCard } from "@/features/traffic/view/TrafficExpandableCard"
import {
  overviewAnalyticCardHeaderClassName,
  overviewAnalyticCardShellClassName,
  overviewSectionHeadingClassName,
} from "@/features/overview/view/overview-card-density"
import { overviewCardPointerFocusResetClassName } from "@/features/overview/view/overview-focus-styles"

type TrafficSourcesCardProps = {
  sources: TrafficSourcesData
}

const tabsListClassName =
  "h-auto w-auto shrink-0 justify-end gap-1 overflow-x-auto border-0 bg-transparent p-0"

const tabsTriggerClassName =
  "h-7 rounded-md border-0 px-2 py-1 text-xs font-medium data-[state=active]:bg-muted data-[state=active]:shadow-none"

type TrafficSourcesTabsProps = {
  sources: TrafficSourcesData
}

function TrafficSourcesExpanded({ sources }: TrafficSourcesTabsProps) {
  return (
    <Tabs defaultValue="referrers" className="gap-0">
      <div className="flex justify-end border-b border-border px-6 py-3">
        <TabsList className={tabsListClassName}>
          <TabsTrigger value="referrers" className={tabsTriggerClassName}>
            Referrers
          </TabsTrigger>
          <TabsTrigger value="utm" className={tabsTriggerClassName}>
            UTM Parameters
          </TabsTrigger>
        </TabsList>
      </div>
      <TabsContent
        value="referrers"
        className="mt-0 outline-none focus:outline-none focus-visible:outline-none data-[state=inactive]:hidden"
      >
        <TrafficBreakdownTableView
          table={sources.referrers}
          emptyMessage="No referrer data for this period."
        />
      </TabsContent>
      <TabsContent
        value="utm"
        className="mt-0 outline-none focus:outline-none focus-visible:outline-none data-[state=inactive]:hidden"
      >
        <TrafficBreakdownTableView
          table={sources.utmParameters}
          emptyMessage="No UTM data for this period."
        />
      </TabsContent>
    </Tabs>
  )
}

function TrafficSourcesCardBody({ sources }: TrafficSourcesCardProps) {
  return (
    <Card
      className={cn(
        overviewCardPointerFocusResetClassName,
        overviewAnalyticCardShellClassName,
        "max-w-none pb-2"
      )}
    >
      <Tabs defaultValue="referrers" className="gap-0">
        <CardHeader
          className={cn(
            overviewAnalyticCardHeaderClassName,
            "flex-row items-center justify-between gap-3 space-y-0"
          )}
        >
          <CardTitle className={overviewSectionHeadingClassName}>
            Traffic Sources
          </CardTitle>
          <TabsList className={tabsListClassName}>
            <TabsTrigger value="referrers" className={tabsTriggerClassName}>
              Referrers
            </TabsTrigger>
            <TabsTrigger value="utm" className={tabsTriggerClassName}>
              UTM Parameters
            </TabsTrigger>
          </TabsList>
        </CardHeader>
        <CardContent className="p-0 pb-2">
          <TabsContent
            value="referrers"
            className="mt-0 outline-none focus:outline-none focus-visible:outline-none data-[state=inactive]:hidden"
          >
            <TrafficBreakdownTableView
              table={sources.referrers}
              emptyMessage="No referrer data for this period."
            />
          </TabsContent>
          <TabsContent
            value="utm"
            className="mt-0 outline-none focus:outline-none focus-visible:outline-none data-[state=inactive]:hidden"
          >
            <TrafficBreakdownTableView
              table={sources.utmParameters}
              emptyMessage="No UTM data for this period."
            />
          </TabsContent>
        </CardContent>
      </Tabs>
    </Card>
  )
}

export function TrafficSourcesCard({ sources }: TrafficSourcesCardProps) {
  return (
    <TrafficExpandableCard
      title="Traffic Sources"
      expandedContent={<TrafficSourcesExpanded sources={sources} />}
    >
      <TrafficSourcesCardBody sources={sources} />
    </TrafficExpandableCard>
  )
}
