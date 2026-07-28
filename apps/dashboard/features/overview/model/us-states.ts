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

export type OverviewMapBubbleTier = 0 | 1 | 2 | 3

export const OVERVIEW_MAP_TIER_COLORS: Record<OverviewMapBubbleTier, string> = {
  0: "rgba(34, 197, 94, 0.55)",
  1: "rgba(249, 115, 22, 0.55)",
  2: "rgba(139, 92, 246, 0.5)",
  3: "rgba(236, 72, 153, 0.55)",
}

export const OVERVIEW_MAP_TIER_STROKES: Record<OverviewMapBubbleTier, string> =
  {
    0: "rgba(22, 163, 74, 0.85)",
    1: "rgba(234, 88, 12, 0.85)",
    2: "rgba(124, 58, 237, 0.85)",
    3: "rgba(219, 39, 119, 0.85)",
  }

export function overviewMapBubbleTier(maxValue: number): {
  thresholds: [number, number, number]
  labels: [string, string, string, string]
} {
  const max = Math.max(0, maxValue)
  if (max <= 0) {
    return {
      thresholds: [0, 0, 0],
      labels: ["0", "0", "0", "0"],
    }
  }

  const t1 = max * 0.15
  const t2 = max * 0.4
  const t3 = max * 0.7

  const fmt = (v: number) => {
    if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M`
    if (v >= 1_000) return `${(v / 1_000).toFixed(1)}K`
    if (Number.isInteger(v) || v >= 10) return String(Math.round(v))
    return v.toFixed(1)
  }

  return {
    thresholds: [t1, t2, t3],
    labels: [
      `< ${fmt(t1)}`,
      `${fmt(t1)} – ${fmt(t2)}`,
      `${fmt(t2)} – ${fmt(t3)}`,
      `> ${fmt(t3)}`,
    ],
  }
}

export function overviewMapBubbleTierForValue(
  value: number,
  thresholds: [number, number, number]
): OverviewMapBubbleTier {
  if (value <= thresholds[0]) return 0
  if (value <= thresholds[1]) return 1
  if (value <= thresholds[2]) return 2
  return 3
}

export function overviewMapBubbleRadius(
  value: number,
  maxValue: number,
  minR = 4,
  maxR = 28
): number {
  if (maxValue <= 0 || value <= 0) return minR
  const t = Math.sqrt(value / maxValue)
  return minR + t * (maxR - minR)
}
