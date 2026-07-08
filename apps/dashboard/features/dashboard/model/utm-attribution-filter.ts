export type UtmFilterDimension = "utm_source" | "utm_medium"

export type DashboardUtmFilter = {
  dimension: UtmFilterDimension
  value: string
}

export const UTM_FILTER_DIMENSION_OPTIONS: {
  id: UtmFilterDimension | "all"
  label: string
}[] = [
  { id: "all", label: "All traffic" },
  { id: "utm_source", label: "UTM Source" },
  { id: "utm_medium", label: "UTM Medium" },
]

export function isUtmFilterDimension(
  value: string | null | undefined
): value is UtmFilterDimension {
  return value === "utm_source" || value === "utm_medium"
}

export function parseDashboardUtmFilter(
  dimension?: string | null,
  value?: string | null
): DashboardUtmFilter | undefined {
  const dim = dimension?.trim()
  const val = value?.trim()
  if (!dim || !val || !isUtmFilterDimension(dim)) return undefined
  if (val.length > 100) return undefined
  return { dimension: dim, value: val }
}

export function utmFilterDimensionLabel(dimension: UtmFilterDimension): string {
  return dimension === "utm_source" ? "UTM Source" : "UTM Medium"
}
