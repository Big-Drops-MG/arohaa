import type { DataExportLeadRow } from "@/features/data-export/model/data-export"
import { normalizeUsStateName } from "@/features/overview/model/us-states"
import {
  getDashboardZonedParts,
  getDashboardTimezoneAbbreviation,
} from "@/lib/datetime"

export type Level1StatBreakdown = {
  label: string
  value: number
}

export type Level1Stat = {
  id: string
  label: string
  value: string
  metricLabel?: string
  metricValue?: number
  breakdown?: Level1StatBreakdown[]
  enoughData: boolean
}

export const LEVEL1_STAT_IDS = [
  "best-time",
  "best-zip",
  "form-submission-ratio",
  "best-age-group",
  "best-city",
  "best-state",
] as const

/** Same bands as Insights age analytics. */
export const LEVEL1_AGE_GROUPS = [
  "Under 25",
  "25-34",
  "35-44",
  "45-54",
  "55-64",
  "65+",
] as const

export type Level1AgeGroup = (typeof LEVEL1_AGE_GROUPS)[number]

function formatHourWindow(hour: number, sampleDate: Date): string {
  const formatHour = (value: number) => {
    const normalized = ((value % 24) + 24) % 24
    const suffix = normalized >= 12 ? "PM" : "AM"
    const displayHour = normalized % 12 || 12
    return `${displayHour}:00 ${suffix}`
  }
  const zone = getDashboardTimezoneAbbreviation(sampleDate)
  return `${formatHour(hour)} – ${formatHour(hour + 1)} ${zone}`
}

function formatPercentShare(part: number, total: number): string {
  if (total <= 0) return "0%"
  const pct = (part / total) * 100
  const rounded =
    Number.isInteger(pct) || Math.abs(pct - Math.round(pct)) < 1e-9
      ? String(Math.round(pct))
      : pct.toFixed(1).replace(/\.0$/, "")
  return `${rounded}%`
}

/** Yes:No share of all leads, as percentages of the total. */
function formatYesNoRatio(yesCount: number, noCount: number): string {
  const total = yesCount + noCount
  if (total <= 0) return "—"
  return `${formatPercentShare(yesCount, total)} : ${formatPercentShare(noCount, total)}`
}

/** Same parsing as the leads table When column. */
export function parseLeadWhen(
  value: string | number | null | undefined
): Date | null {
  if (value == null || value === "") return null
  if (typeof value === "number") {
    const date = new Date(value)
    return Number.isNaN(date.getTime()) ? null : date
  }
  const trimmed = String(value).trim()
  if (!trimmed || trimmed.startsWith("1970-")) return null
  const date = new Date(
    trimmed.includes("T") ? trimmed : `${trimmed.replace(" ", "T")}Z`
  )
  if (Number.isNaN(date.getTime())) return null
  return date
}

function normalizeLeadZip(value: string | null | undefined): string | null {
  const zip = String(value ?? "").trim()
  return zip ? zip : null
}

function pickFieldValue(
  fields: Record<string, string> | null | undefined,
  keys: string[]
): string | null {
  if (!fields) return null
  const byLower = new Map<string, string>()
  for (const [key, value] of Object.entries(fields)) {
    const trimmed = String(value ?? "").trim()
    if (!trimmed) continue
    byLower.set(key.trim().toLowerCase(), trimmed)
  }
  for (const key of keys) {
    const value = byLower.get(key.toLowerCase())
    if (value) return value
  }
  return null
}

function parseDobParts(
  raw: string
): { month: number; day: number; year: number } | null {
  const match = raw.trim().match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/)
  if (!match) return null
  const month = Number(match[1])
  const day = Number(match[2])
  const year = Number(match[3])
  if (
    !Number.isFinite(month) ||
    !Number.isFinite(day) ||
    !Number.isFinite(year) ||
    month < 1 ||
    month > 12 ||
    day < 1 ||
    day > 31 ||
    year < 1900
  ) {
    return null
  }
  return { month, day, year }
}

function ageFromDob(
  raw: string | null | undefined,
  now: { year: number; month: number; day: number }
): number | null {
  if (!raw?.trim()) return null
  const parts = parseDobParts(raw)
  if (!parts) return null
  let age = now.year - parts.year
  if (
    now.month < parts.month ||
    (now.month === parts.month && now.day < parts.day)
  ) {
    age -= 1
  }
  if (age < 0 || age > 120) return null
  return age
}

export function ageGroupFromAge(age: number): Level1AgeGroup | null {
  if (!Number.isFinite(age) || age < 0 || age > 120) return null
  if (age < 25) return "Under 25"
  if (age < 35) return "25-34"
  if (age < 45) return "35-44"
  if (age < 55) return "45-54"
  if (age < 65) return "55-64"
  return "65+"
}

function resolveLeadAge(
  fields: Record<string, string> | null | undefined,
  now: { year: number; month: number; day: number }
): number | null {
  const dob = pickFieldValue(fields, ["dob"])
  const fromDob = ageFromDob(dob, now)
  if (fromDob != null) return fromDob

  const rawAge = pickFieldValue(fields, ["driver_0_age", "age"])
  if (!rawAge) return null
  const age = Number(rawAge.replace(/\D/g, ""))
  if (!Number.isFinite(age) || age < 0 || age > 120) return null
  return age
}

function pickBestCountKey<T>(counts: Map<T, number>): {
  key: T | null
  count: number
} {
  let bestKey: T | null = null
  let bestCount = 0
  for (const [key, count] of counts) {
    if (count > bestCount) {
      bestKey = key
      bestCount = count
    }
  }
  return { key: bestKey, count: bestCount }
}

function bestSubmissionStat(
  id: string,
  label: string,
  best: { key: string | null; count: number }
): Level1Stat {
  return {
    id,
    label,
    value: best.count > 0 && best.key ? best.key : "—",
    metricLabel: "Form submissions",
    metricValue: best.count,
    enoughData: best.count > 0,
  }
}

export function computeLevel1StatsFromLeads(
  leads: DataExportLeadRow[]
): Level1Stat[] {
  const hourCounts = new Map<number, number>()
  const zipCounts = new Map<string, number>()
  const ageGroupCounts = new Map<string, number>()
  const cityCounts = new Map<string, number>()
  const stateCounts = new Map<string, number>()
  let sampleDate: Date | null = null
  let yesCount = 0
  let noCount = 0
  const now = getDashboardZonedParts(new Date())

  for (const lead of leads) {
    if (lead.formSubmitted) yesCount += 1
    else noCount += 1

    if (!lead.formSubmitted) continue

    const when = parseLeadWhen(lead.createdAt)
    if (when) {
      sampleDate ??= when
      const hour = getDashboardZonedParts(when).hour
      hourCounts.set(hour, (hourCounts.get(hour) ?? 0) + 1)
    }

    const zip = normalizeLeadZip(lead.zip)
    if (zip) {
      zipCounts.set(zip, (zipCounts.get(zip) ?? 0) + 1)
    }

    const age = resolveLeadAge(lead.fields, now)
    const ageGroup = age != null ? ageGroupFromAge(age) : null
    if (ageGroup) {
      ageGroupCounts.set(ageGroup, (ageGroupCounts.get(ageGroup) ?? 0) + 1)
    }

    const city = pickFieldValue(lead.fields, ["city"])
    if (city) {
      cityCounts.set(city, (cityCounts.get(city) ?? 0) + 1)
    }

    const stateRaw = pickFieldValue(lead.fields, ["state"])
    const state = stateRaw ? (normalizeUsStateName(stateRaw) ?? stateRaw) : null
    if (state) {
      stateCounts.set(state, (stateCounts.get(state) ?? 0) + 1)
    }
  }

  const bestTime = pickBestCountKey(hourCounts)
  const bestZip = pickBestCountKey(zipCounts)
  const bestAgeGroup = pickBestCountKey(ageGroupCounts)
  const bestCity = pickBestCountKey(cityCounts)
  const bestState = pickBestCountKey(stateCounts)
  const totalLeads = yesCount + noCount

  return [
    {
      id: "best-time",
      label: "Best Time",
      value:
        bestTime.count > 0 && bestTime.key != null && sampleDate
          ? formatHourWindow(bestTime.key, sampleDate)
          : "—",
      metricLabel: "Form submissions",
      metricValue: bestTime.count,
      enoughData: bestTime.count > 0,
    },
    bestSubmissionStat("best-zip", "Best ZIP", {
      key: bestZip.key,
      count: bestZip.count,
    }),
    {
      id: "form-submission-ratio",
      label: "Form Submission Ratio (Yes : No)",
      value: totalLeads > 0 ? formatYesNoRatio(yesCount, noCount) : "—",
      breakdown: [
        { label: "Yes", value: yesCount },
        { label: "No", value: noCount },
      ],
      enoughData: totalLeads > 0,
    },
    bestSubmissionStat("best-age-group", "Best Age Group", {
      key: bestAgeGroup.key,
      count: bestAgeGroup.count,
    }),
    bestSubmissionStat("best-city", "Best City", {
      key: bestCity.key,
      count: bestCity.count,
    }),
    bestSubmissionStat("best-state", "Best State", {
      key: bestState.key,
      count: bestState.count,
    }),
  ]
}

export function emptyLevel1Stats(): Level1Stat[] {
  return [
    {
      id: "best-time",
      label: "Best Time",
      value: "—",
      metricLabel: "Form submissions",
      metricValue: 0,
      enoughData: false,
    },
    {
      id: "best-zip",
      label: "Best ZIP",
      value: "—",
      metricLabel: "Form submissions",
      metricValue: 0,
      enoughData: false,
    },
    {
      id: "form-submission-ratio",
      label: "Form Submission Ratio (Yes : No)",
      value: "—",
      breakdown: [
        { label: "Yes", value: 0 },
        { label: "No", value: 0 },
      ],
      enoughData: false,
    },
    {
      id: "best-age-group",
      label: "Best Age Group",
      value: "—",
      metricLabel: "Form submissions",
      metricValue: 0,
      enoughData: false,
    },
    {
      id: "best-city",
      label: "Best City",
      value: "—",
      metricLabel: "Form submissions",
      metricValue: 0,
      enoughData: false,
    },
    {
      id: "best-state",
      label: "Best State",
      value: "—",
      metricLabel: "Form submissions",
      metricValue: 0,
      enoughData: false,
    },
  ]
}

export type Level1Payload = {
  section: "level1"
  stats: Level1Stat[]
}

export function emptyLevel1Payload(): Level1Payload {
  return { section: "level1", stats: emptyLevel1Stats() }
}

export function hasCompleteLevel1Stats(
  level1Stats: Level1Stat[] | undefined
): boolean {
  if (!level1Stats?.length) return false
  const ids = new Set(level1Stats.map((stat) => stat.id))
  return LEVEL1_STAT_IDS.every((id) => ids.has(id))
}

/**
 * The API computes stats over every lead in the range, while `leads` is only
 * the current page, so API stats win whenever they cover the full Level 1 set.
 */
export function resolveLevel1Stats(
  level1Stats: Level1Stat[] | undefined,
  leads: DataExportLeadRow[]
): { stats: Level1Stat[]; complete: boolean } {
  if (hasCompleteLevel1Stats(level1Stats)) {
    return { stats: level1Stats!, complete: true }
  }
  return { stats: computeLevel1StatsFromLeads(leads), complete: false }
}
