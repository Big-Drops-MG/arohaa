export const DATA_LAB_SECTIONS = [
  { id: "level-1", label: "Level 1" },
  { id: "leads", label: "Leads table" },
] as const

export type DataLabSectionId = (typeof DATA_LAB_SECTIONS)[number]["id"]

const SECTION_IDS = new Set<string>(DATA_LAB_SECTIONS.map((s) => s.id))

export function parseDataLabSection(
  value: string | null | undefined
): DataLabSectionId {
  if (value && SECTION_IDS.has(value)) return value as DataLabSectionId
  return "level-1"
}

export function dataLabSectionLabel(id: DataLabSectionId): string {
  return DATA_LAB_SECTIONS.find((s) => s.id === id)?.label ?? id
}

export function mapLegacyInsightSectionToDataLab(
  section: string | null | undefined
): DataLabSectionId {
  return normalizeDataLabSectionId(section ?? "")
}

/** Map stored section ids (including legacy Data Lab tabs) to current tabs. */
export function normalizeDataLabSectionId(section: string): DataLabSectionId {
  if (SECTION_IDS.has(section)) return section as DataLabSectionId
  if (section === "export") return "leads"
  return "level-1"
}
