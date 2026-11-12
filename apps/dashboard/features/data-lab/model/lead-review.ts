import type { DataExportLeadRow } from "@/features/data-export/model/data-export"

export const LEAD_REVIEW_FILTERS = [
  { id: "all", label: "Submissions" },
  { id: "elevated", label: "Elevated risk", tone: "fraud" as const },
  { id: "incomplete", label: "Incomplete data" },
  { id: "paste", label: "Paste activity" },
] as const

export type LeadReviewFilterId = (typeof LEAD_REVIEW_FILTERS)[number]["id"]

export function leadHasElevatedRisk(lead: DataExportLeadRow): boolean {
  const fraud = lead.fraud
  return Boolean(
    fraud?.scoreAvailable &&
    (fraud.effectiveLabel === "fraud" || fraud.label === "fraud")
  )
}

export function leadHasIncompleteAssessment(lead: DataExportLeadRow): boolean {
  const fraud = lead.fraud
  return fraud == null || fraud.coverage === "insufficient"
}

export function leadHasPasteActivity(lead: DataExportLeadRow): boolean {
  return (lead.behavior?.pasteCount ?? 0) > 0
}

export function matchesLeadReviewFilter(
  lead: DataExportLeadRow,
  filter: LeadReviewFilterId
): boolean {
  if (filter === "all") return true
  if (filter === "elevated") return leadHasElevatedRisk(lead)
  if (filter === "incomplete") return leadHasIncompleteAssessment(lead)
  if (filter === "paste") return leadHasPasteActivity(lead)
  return true
}

export function summarizeLeadReview(leads: DataExportLeadRow[]): {
  submissions: number
  elevated: number
  incomplete: number
  paste: number
} {
  let elevated = 0
  let incomplete = 0
  let paste = 0
  for (const lead of leads) {
    if (leadHasElevatedRisk(lead)) elevated += 1
    if (leadHasIncompleteAssessment(lead)) incomplete += 1
    if (leadHasPasteActivity(lead)) paste += 1
  }
  return {
    submissions: leads.length,
    elevated,
    incomplete,
    paste,
  }
}

export function pasteActivityLabel(lead: DataExportLeadRow): string {
  const count = lead.behavior?.pasteCount ?? 0
  if (count <= 0) return "—"
  if (count === 1) return "Paste (Ctrl+V)"
  return `Paste ×${count}`
}
