import type { OverviewKpiMetricId } from "@/features/overview/model/overview"

/** US state FIPS id → canonical name (matches us-atlas topojson feature ids). */
export const US_STATE_FIPS_TO_NAME: Record<string, string> = {
  "01": "Alabama",
  "02": "Alaska",
  "04": "Arizona",
  "05": "Arkansas",
  "06": "California",
  "08": "Colorado",
  "09": "Connecticut",
  "10": "Delaware",
  "11": "District of Columbia",
  "12": "Florida",
  "13": "Georgia",
  "15": "Hawaii",
  "16": "Idaho",
  "17": "Illinois",
  "18": "Indiana",
  "19": "Iowa",
  "20": "Kansas",
  "21": "Kentucky",
  "22": "Louisiana",
  "23": "Maine",
  "24": "Maryland",
  "25": "Massachusetts",
  "26": "Michigan",
  "27": "Minnesota",
  "28": "Mississippi",
  "29": "Missouri",
  "30": "Montana",
  "31": "Nebraska",
  "32": "Nevada",
  "33": "New Hampshire",
  "34": "New Jersey",
  "35": "New Mexico",
  "36": "New York",
  "37": "North Carolina",
  "38": "North Dakota",
  "39": "Ohio",
  "40": "Oklahoma",
  "41": "Oregon",
  "42": "Pennsylvania",
  "44": "Rhode Island",
  "45": "South Carolina",
  "46": "South Dakota",
  "47": "Tennessee",
  "48": "Texas",
  "49": "Utah",
  "50": "Vermont",
  "51": "Virginia",
  "53": "Washington",
  "54": "West Virginia",
  "55": "Wisconsin",
  "56": "Wyoming",
}

export const US_STATE_NAME_TO_FIPS: Record<string, string> = Object.fromEntries(
  Object.entries(US_STATE_FIPS_TO_NAME).map(([fips, name]) => [name, fips])
)

const US_STATE_CODE_TO_NAME: Record<string, string> = {
  AL: "Alabama",
  AK: "Alaska",
  AZ: "Arizona",
  AR: "Arkansas",
  CA: "California",
  CO: "Colorado",
  CT: "Connecticut",
  DE: "Delaware",
  DC: "District of Columbia",
  FL: "Florida",
  GA: "Georgia",
  HI: "Hawaii",
  ID: "Idaho",
  IL: "Illinois",
  IN: "Indiana",
  IA: "Iowa",
  KS: "Kansas",
  KY: "Kentucky",
  LA: "Louisiana",
  ME: "Maine",
  MD: "Maryland",
  MA: "Massachusetts",
  MI: "Michigan",
  MN: "Minnesota",
  MS: "Mississippi",
  MO: "Missouri",
  MT: "Montana",
  NE: "Nebraska",
  NV: "Nevada",
  NH: "New Hampshire",
  NJ: "New Jersey",
  NM: "New Mexico",
  NY: "New York",
  NC: "North Carolina",
  ND: "North Dakota",
  OH: "Ohio",
  OK: "Oklahoma",
  OR: "Oregon",
  PA: "Pennsylvania",
  RI: "Rhode Island",
  SC: "South Carolina",
  SD: "South Dakota",
  TN: "Tennessee",
  TX: "Texas",
  UT: "Utah",
  VT: "Vermont",
  VA: "Virginia",
  WA: "Washington",
  WV: "West Virginia",
  WI: "Wisconsin",
  WY: "Wyoming",
}

const NAME_BY_LOWER = new Map(
  Object.values(US_STATE_FIPS_TO_NAME).map((name) => [name.toLowerCase(), name])
)

/** Normalize GeoIP state labels (name or USPS code) to canonical US state names. */
export function normalizeUsStateName(raw: string): string | null {
  const trimmed = raw.trim()
  if (!trimmed) return null

  const byCode = US_STATE_CODE_TO_NAME[trimmed.toUpperCase()]
  if (byCode) return byCode

  const byName = NAME_BY_LOWER.get(trimmed.toLowerCase())
  if (byName) return byName

  return null
}

export const US_STATES_TOPOJSON_URL =
  "https://cdn.jsdelivr.net/npm/us-atlas@3/states-10m.json"

export const US_COUNTIES_TOPOJSON_URL =
  "https://cdn.jsdelivr.net/npm/us-atlas@3/counties-10m.json"

export type OverviewMapDrillLevel = "usa" | "state"

export type OverviewMapBubbleTier = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8

/** ColorBrewer YlGnBu-9 sequential scale (low → high). */
export const OVERVIEW_MAP_TIER_COLORS: Record<OverviewMapBubbleTier, string> = {
  0: "#ffffd9",
  1: "#edf9b1",
  2: "#c7e9b4",
  3: "#7fcdbb",
  4: "#41b6c4",
  5: "#1d91c0",
  6: "#225ea8",
  7: "#253494",
  8: "#071d58",
}

export const OVERVIEW_MAP_TIER_STROKES: Record<OverviewMapBubbleTier, string> =
  {
    0: "#c7e9b4",
    1: "#7fcdbb",
    2: "#41b6c4",
    3: "#1d91c0",
    4: "#225ea8",
    5: "#253494",
    6: "#071d58",
    7: "#071d58",
    8: "#020b2e",
  }

function hexToRgba(hex: string, alpha: number): string {
  const raw = hex.replace("#", "")
  const r = Number.parseInt(raw.slice(0, 2), 16)
  const g = Number.parseInt(raw.slice(2, 4), 16)
  const b = Number.parseInt(raw.slice(4, 6), 16)
  return `rgba(${r}, ${g}, ${b}, ${alpha})`
}

export const OVERVIEW_MAP_TIER_FILLS: Record<OverviewMapBubbleTier, string> = {
  0: hexToRgba(OVERVIEW_MAP_TIER_COLORS[0], 0.88),
  1: hexToRgba(OVERVIEW_MAP_TIER_COLORS[1], 0.88),
  2: hexToRgba(OVERVIEW_MAP_TIER_COLORS[2], 0.88),
  3: hexToRgba(OVERVIEW_MAP_TIER_COLORS[3], 0.9),
  4: hexToRgba(OVERVIEW_MAP_TIER_COLORS[4], 0.9),
  5: hexToRgba(OVERVIEW_MAP_TIER_COLORS[5], 0.92),
  6: hexToRgba(OVERVIEW_MAP_TIER_COLORS[6], 0.92),
  7: hexToRgba(OVERVIEW_MAP_TIER_COLORS[7], 0.94),
  8: hexToRgba(OVERVIEW_MAP_TIER_COLORS[8], 0.95),
}

export const OVERVIEW_MAP_TIER_IDS = [
  0, 1, 2, 3, 4, 5, 6, 7, 8,
] as const satisfies readonly OverviewMapBubbleTier[]

function formatOverviewMapSlabLabel(value: number, isPercent: boolean): string {
  if (isPercent) {
    if (Number.isInteger(value)) return `${value}%`
    return `${value.toFixed(1)}%`
  }
  if (value >= 1_000_000)
    return `${(value / 1_000_000).toFixed(value % 1_000_000 === 0 ? 0 : 1)}M`
  if (value >= 1_000)
    return `${(value / 1_000).toFixed(value % 1_000 === 0 ? 0 : 1)}K`
  if (Number.isInteger(value) || value >= 10) return String(Math.round(value))
  return value.toFixed(1)
}

/**
 * Absolute choropleth cut points (8 → 9 color slabs).
 * Colors encode fixed performance bands, not relative rank within the current dataset.
 */
export function overviewMapAbsoluteThresholds(
  metricId: OverviewKpiMetricId
): number[] {
  switch (metricId) {
    case "fsr":
    case "bounce-rate":
      // Percentage points 0–100
      return [10, 20, 30, 40, 50, 60, 70, 85]
    case "visitors":
    case "sessions":
    case "page-views":
    case "form-submitted":
      // Absolute count bands; final open-ended slab is 5000+
      return [100, 250, 500, 1000, 2000, 3000, 4000, 5000]
  }
}

export function overviewMapBubbleTier(metricId: OverviewKpiMetricId): {
  thresholds: number[]
  legendLabels: string[]
  minLabel: string
  maxLabel: string
} {
  const thresholds = overviewMapAbsoluteThresholds(metricId)
  const isPercent = metricId === "fsr" || metricId === "bounce-rate"
  const last = thresholds[thresholds.length - 1] ?? 0
  const legendLabels = [
    formatOverviewMapSlabLabel(0, isPercent),
    ...thresholds.map((t) => formatOverviewMapSlabLabel(t, isPercent)),
  ]
  // Final label is open-ended (“5000+”) so the scale reads as absolute slabs.
  legendLabels[legendLabels.length - 1] =
    `${formatOverviewMapSlabLabel(last, isPercent)}+`

  return {
    thresholds,
    legendLabels,
    minLabel: legendLabels[0] ?? "0",
    maxLabel: legendLabels[legendLabels.length - 1] ?? "0",
  }
}

export function overviewMapBubbleTierForValue(
  value: number,
  thresholds: readonly number[]
): OverviewMapBubbleTier {
  let tier = 0
  for (let i = 0; i < thresholds.length; i += 1) {
    if (value > (thresholds[i] ?? 0)) tier = i + 1
  }
  return Math.min(8, tier) as OverviewMapBubbleTier
}

export function overviewMapBubbleRadius(
  value: number,
  maxValue: number,
  minR = 5,
  maxR = 44
): number {
  if (maxValue <= 0 || value <= 0) return minR
  // Area-aware scale with a slightly steeper curve so low vs high values
  // read clearly as small vs large bubbles on the map.
  const t = Math.pow(value / maxValue, 0.58)
  return minR + t * (maxR - minR)
}

function hashString(input: string): number {
  let h = 2166136261
  for (let i = 0; i < input.length; i += 1) {
    h ^= input.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}

/**
 * Place a city inside a geographic bbox when precise coordinates are unknown.
 * Positions are stable for a given city name so drill-down views stay consistent.
 */
export function overviewCityPointInBbox(
  city: string,
  bbox: [[number, number], [number, number]]
): [number, number] {
  const [[minLng, minLat], [maxLng, maxLat]] = bbox
  const pad = 0.18
  const h = hashString(city.toLowerCase())
  const u = pad + ((h % 10_000) / 10_000) * (1 - 2 * pad)
  const v = pad + ((Math.floor(h / 10_000) % 10_000) / 10_000) * (1 - 2 * pad)
  return [minLng + u * (maxLng - minLng), minLat + v * (maxLat - minLat)]
}
