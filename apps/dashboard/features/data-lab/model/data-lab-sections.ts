export const DATA_LAB_SECTIONS = [
  {
    id: "intelligence",
    label: "Intelligence Center",
  },
  { id: "glance", label: "At a glance" },
  { id: "leads", label: "Leads table" },
  { id: "sources", label: "Where leads come from" },
  { id: "journey", label: "Form journey" },
  { id: "quality", label: "Lead quality" },
  { id: "tests", label: "Tests and changes" },
] as const

export type DataLabSectionId = (typeof DATA_LAB_SECTIONS)[number]["id"]

const SECTION_IDS = new Set<string>(DATA_LAB_SECTIONS.map((s) => s.id))

export function parseDataLabSection(
  value: string | null | undefined
): DataLabSectionId {
  if (value && SECTION_IDS.has(value)) return value as DataLabSectionId
  return "intelligence"
}

export function dataLabSectionLabel(id: DataLabSectionId): string {
  return DATA_LAB_SECTIONS.find((s) => s.id === id)?.label ?? id
}

/** Map legacy Insights section ids onto Data Lab inner tabs. */
export function mapLegacyInsightSectionToDataLab(
  section: string | null | undefined
): DataLabSectionId {
  switch (section) {
    case "volume":
      return "glance"
    case "source":
      return "sources"
    case "dropoff":
      return "journey"
    case "quality":
    case "vehicle":
    case "risk":
      return "quality"
    case "experiment":
      return "tests"
    case "time":
    case "age":
    case "device":
    case "geo":
      return "intelligence"
    default:
      return "intelligence"
  }
}
