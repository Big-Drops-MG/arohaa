import type { DataExportLeadRow } from "@/features/data-export/model/data-export"

export function leadHasElevatedRisk(lead: DataExportLeadRow): boolean {
  const fraud = lead.fraud
  return Boolean(
    fraud?.scoreAvailable &&
    (fraud.effectiveLabel === "fraud" || fraud.label === "fraud")
  )
}

export function leadSourceLabel(lead: DataExportLeadRow): string {
  const source = lead.utmSource.trim()
  if (source) return source

  const id = lead.utmId.trim()
  if (id) return `utm_id:${id}`

  const s1 = (lead.utmS1 || "").trim()
  if (s1) return `s1:${s1}`

  const fromFields = [
    lead.fields.utm_source,
    lead.fields.utmsource,
    lead.fields.sid,
    lead.fields.source,
  ]
    .map((value) => (value || "").trim())
    .find(Boolean)
  if (fromFields) return fromFields

  return "—"
}

export function leadSourceDetail(lead: DataExportLeadRow): string {
  const parts = [
    lead.utmSource.trim() ? `source=${lead.utmSource.trim()}` : "",
    lead.utmId.trim() ? `id=${lead.utmId.trim()}` : "",
    (lead.utmS1 || "").trim() ? `s1=${lead.utmS1.trim()}` : "",
  ].filter(Boolean)
  return parts.join(" · ")
}

export function pasteActivityLabel(lead: DataExportLeadRow): string {
  const count = lead.behavior?.pasteCount ?? 0
  if (count <= 0) return "—"
  if (count === 1) return "Paste (Ctrl+V)"
  return `Paste ×${count}`
}
