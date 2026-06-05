import type { ExperimentVariantRef } from "@/features/experiments/model/experiments"
import type { OverviewLandingFormType } from "@/features/overview/model/overview"
import type { TrafficBreakdownTable } from "@/features/traffic/model/traffic"

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
