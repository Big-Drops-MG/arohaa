"use client"

import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@workspace/ui/components/tabs"

const PROJECT_TABS = [
  { value: "overview", label: "Overview" },
  { value: "traffic", label: "Traffic" },
  { value: "funnel", label: "Funnel" },
  { value: "event-tracking", label: "Event Tracking" },
  { value: "segments", label: "Segments" },
  { value: "experiments", label: "Experiments" },
  { value: "alerts", label: "Alerts" },
  { value: "settings", label: "Settings" },
] as const

export function ProjectDashboardView() {
  return (
    <div className="flex w-full flex-1 flex-col">
      <Tabs defaultValue="overview" className="w-full">
        <div className="w-full border-b border-neutral-200 bg-neutral-50/90">
          <div className="mx-auto w-full max-w-[1440px] px-0">
            <TabsList className="h-auto min-h-11 justify-start rounded-none border-0 bg-transparent px-0">
              {PROJECT_TABS.map((tab) => (
                <TabsTrigger key={tab.value} value={tab.value}>
                  {tab.label}
                </TabsTrigger>
              ))}
            </TabsList>
          </div>
        </div>

        <div className="mx-auto w-full max-w-[1440px] pb-10">
          {PROJECT_TABS.map((tab) => (
            <TabsContent key={tab.value} value={tab.value}>
              <p className="max-w-prose text-sm text-muted-foreground">
                <span className="font-medium text-foreground">{tab.label}</span>{" "}
                for this landing page.
              </p>
            </TabsContent>
          ))}
        </div>
      </Tabs>
    </div>
  )
}
