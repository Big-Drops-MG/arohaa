import type { ExperimentVariantRef } from "@/features/experiments/model/experiments"
import type { OverviewLandingFormType } from "@/features/overview/model/overview"
import type { TrafficBreakdownTable } from "@/features/traffic/model/traffic"

/**
 * Turns a stored variant label ("A") into its display form ("Variant A").
 * Labels that already read as a variant, and the "Unknown" bucket emitted by
 * analytics for unmatched traffic, are passed through unchanged.
 */
export function experimentVariantDisplayLabel(label: string): string {
  const trimmed = label.trim()
  if (!trimmed) return "Unknown"
  if (trimmed.toLowerCase() === "unknown") return trimmed
  if (/^variants?\b/i.test(trimmed)) return trimmed
  return `Variant ${trimmed}`
}

/** Row identity used to match a variant row across the experiment tables. */
export function experimentVariantRowId(label: string): string {
  return experimentVariantDisplayLabel(label).toLowerCase().replace(/\s+/g, "-")
}

/**
 * Column key that carries a variant's rate in the location breakdowns. The
 * analytics payload keys those cells by raw label, so the label is not
 * normalised here.
 */
export function experimentVariantRateColumnId(label: string): string {
  return `variant${label}`
}

export function experimentVariantPerformanceSubmitLabel(
  formType: OverviewLandingFormType
): string {
  return formType === "zip" ? "Zip Submit" : "Form Submit"
}

export function experimentVariantPerformanceRateLabel(
  formType: OverviewLandingFormType
): string {
  return formType === "zip" ? "ZSR" : "FSR"
}

function formSubmittedLabel(formType: OverviewLandingFormType): string {
  return formType === "zip" ? "Zip Submitted" : "Form Submitted"
}

function rateLabel(formType: OverviewLandingFormType): string {
  return formType === "zip" ? "ZSR" : "FSR"
}

function variantIdFromRow(row: Record<string, string>): string | null {
  const explicit = row.variantId?.trim()
  if (explicit) return explicit

  const label = row.variant?.trim()
  if (!label) return null

  return label.toLowerCase().replace(/\s+/g, "-")
}

export function experimentVariantsFromPerformanceTable(
  table: TrafficBreakdownTable
): ExperimentVariantRef[] {
  const variants: ExperimentVariantRef[] = []

  for (const row of table.rows) {
    const id = variantIdFromRow(row)
    const label = row.variant?.trim()
    if (!id || !label) continue
    if (variants.some((variant) => variant.id === id)) continue

    variants.push({ id, label })
  }

  return variants
}

export function experimentVariantPerformanceColumns(
  formType: OverviewLandingFormType
): TrafficBreakdownTable["columns"] {
  return [
    { id: "variant", label: "Variant" },
    { id: "visitors", label: "Visitors", align: "right" },
    {
      id: "formSubmitted",
      label: formSubmittedLabel(formType),
      align: "right",
    },
    { id: "rate", label: rateLabel(formType), align: "right" },
  ]
}

export function experimentPerformanceByLocationColumns(
  formType: OverviewLandingFormType,
  variants: ExperimentVariantRef[]
): TrafficBreakdownTable["columns"] {
  const rate = rateLabel(formType)

  return [
    { id: "city", label: "City" },
    ...variants.map((variant) => ({
      id: `${variant.id}-fsr`,
      label: `${variant.label} ${rate}`,
      align: "right" as const,
    })),
  ]
}

export function syncPerformanceByLocationWithVariants(
  formType: OverviewLandingFormType,
  variantPerformance: TrafficBreakdownTable,
  performanceByLocation: TrafficBreakdownTable
): TrafficBreakdownTable {
  const variants = experimentVariantsFromPerformanceTable(variantPerformance)
  const columns = experimentPerformanceByLocationColumns(formType, variants)
  const variantColumnIds = columns
    .map((column) => column.id)
    .filter((id) => id !== "city")

  const rows = performanceByLocation.rows.map((row) => {
    const next: Record<string, string> = {
      city: row.city ?? "-",
    }

    for (const columnId of variantColumnIds) {
      next[columnId] = row[columnId] ?? "-"
    }

    return next
  })

  return { columns, rows }
}
