export const PROJECT_TABS = [
  { value: "overview", label: "Overview" },
  { value: "traffic", label: "Traffic" },
  { value: "funnel", label: "Funnel" },
  { value: "data-lab", label: "Data Lab" },
  { value: "heatmap", label: "Heatmap" },
  { value: "event-tracking", label: "Event Tracking" },
  { value: "segments", label: "Performance" },
  { value: "experiments", label: "Experiments" },
  { value: "seo", label: "SEO" },
  { value: "web-vital", label: "Web Vitals" },
  { value: "utm", label: "UTM Control" },
  { value: "alerts", label: "Alerts" },
  { value: "settings", label: "Settings" },
] as const

export type ProjectTabValue = (typeof PROJECT_TABS)[number]["value"]

const PROJECT_TAB_VALUES = new Set<string>(PROJECT_TABS.map((tab) => tab.value))

/** Legacy tab query values that now open Data Lab. */
const LEGACY_TAB_ALIASES: Record<string, ProjectTabValue> = {
  insights: "data-lab",
  "data-export": "data-lab",
}

export function parseProjectTab(
  value: string | null | undefined
): ProjectTabValue {
  if (!value) return "overview"
  if (LEGACY_TAB_ALIASES[value]) return LEGACY_TAB_ALIASES[value]!
  if (PROJECT_TAB_VALUES.has(value)) return value as ProjectTabValue
  return "overview"
}

export function isLegacyDataLabTab(
  value: string | null | undefined
): value is "insights" | "data-export" {
  return value === "insights" || value === "data-export"
}
