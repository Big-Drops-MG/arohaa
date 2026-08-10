export const INSIGHT_SECTIONS = [
  { id: "volume", label: "Volume" },
  { id: "source", label: "Source" },
  { id: "time", label: "Time" },
  { id: "age", label: "Age" },
  { id: "dropoff", label: "Drop-off" },
  { id: "device", label: "Device" },
  { id: "geo", label: "Geographic" },
  { id: "risk", label: "Risk" },
  { id: "vehicle", label: "Vehicle" },
  { id: "quality", label: "Quality" },
  { id: "experiment", label: "Experiment" },
] as const

export type InsightSectionId = (typeof INSIGHT_SECTIONS)[number]["id"]

const SECTION_IDS = new Set<string>(INSIGHT_SECTIONS.map((s) => s.id))

export function parseInsightSection(
  value: string | null | undefined
): InsightSectionId {
  if (value && SECTION_IDS.has(value)) return value as InsightSectionId
  return "volume"
}

export function insightSectionLabel(id: InsightSectionId): string {
  return INSIGHT_SECTIONS.find((s) => s.id === id)?.label ?? id
}
