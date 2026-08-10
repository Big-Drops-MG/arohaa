export const INSIGHTS_SERIES_COLORS = [
  "#171717",
  "#525252",
  "#2f9ee9",
  "#16a34a",
  "#ca8a04",
  "#dc2626",
  "#7c3aed",
  "#0891b2",
] as const

export function insightsSeriesColor(index: number): string {
  return INSIGHTS_SERIES_COLORS[index % INSIGHTS_SERIES_COLORS.length]!
}
