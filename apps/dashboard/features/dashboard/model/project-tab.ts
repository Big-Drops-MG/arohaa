export const PROJECT_TABS = [
  { value: "overview", label: "Overview" },
  { value: "traffic", label: "Traffic" },
  { value: "funnel", label: "Funnel" },
  { value: "event-tracking", label: "Event Tracking" },
  { value: "segments", label: "Segments" },
  { value: "experiments", label: "Experiments" },
  { value: "seo", label: "SEO" },
  { value: "utm", label: "UTM" },
  { value: "alerts", label: "Alerts" },
  { value: "settings", label: "Settings" },
] as const

export type ProjectTabValue = (typeof PROJECT_TABS)[number]["value"]

const PROJECT_TAB_VALUES = new Set<string>(PROJECT_TABS.map((tab) => tab.value))

export function parseProjectTab(
  value: string | null | undefined
): ProjectTabValue {
  if (value && PROJECT_TAB_VALUES.has(value)) {
    return value as ProjectTabValue
  }
  return "overview"
}
