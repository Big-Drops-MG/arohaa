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
  /** Total leads in this bucket (for context alongside submission count) */
  sampleSize?: number
  /** Formatted submission rate, e.g. "94%" */
  submissionRate?: string
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

/** Wilson score lower bound — ranks by credible efficiency, not raw rate. */
function calculateCredibleRate(
  submitted: number,
  total: number,
  z = 1.64
): number {
  if (total <= 0 || submitted <= 0) return 0
  const p = submitted / total
  const z2 = z * z
  const denominator = 1 + z2 / total
  const centerAdjusted = p + z2 / (2 * total)
  const margin = z * Math.sqrt((p * (1 - p) + z2 / (4 * total)) / total)
  return Math.max(0, (centerAdjusted - margin) / denominator)
}

type BucketCounter = {
  label: string
  total: number
  submitted: number
}

function addBucket(
  counts: Map<string, BucketCounter>,
  label: string,
  submitted: boolean
): void {
  const next = counts.get(label) ?? { label, total: 0, submitted: 0 }
  next.total += 1
  if (submitted) next.submitted += 1
  counts.set(label, next)
}

function pickBestBucket(
  counts: Map<string, BucketCounter>
): BucketCounter | null {
  let best: BucketCounter | null = null
  let bestScore = -1
  for (const bucket of counts.values()) {
    if (bucket.submitted === 0) continue
    const score = calculateCredibleRate(bucket.submitted, bucket.total)
    if (
      score > bestScore ||
      (score === bestScore &&
        (best === null || bucket.submitted > best.submitted))
    ) {
      best = bucket
      bestScore = score
    }
  }
  return best
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

export function computeLevel1StatsFromLeads(
  leads: DataExportLeadRow[]
): Level1Stat[] {
  // Wilson-scored buckets for efficiency-ranked dimensions
  const timeBuckets = new Map<string, BucketCounter>()
  const ageGroupBuckets = new Map<string, BucketCounter>()
  const cityBuckets = new Map<string, BucketCounter>()
  const stateBuckets = new Map<string, BucketCounter>()

  // ZIP stays as highest-submission-count (too granular for credible scoring),
  // but we still track total leads so the UI can show "3 of 5" context.
  const zipBuckets = new Map<string, BucketCounter>()

  let sampleDate: Date | null = null
  let yesCount = 0
  let noCount = 0
  const now = getDashboardZonedParts(new Date())

  for (const lead of leads) {
    if (lead.formSubmitted) yesCount += 1
    else noCount += 1

    const when = parseLeadWhen(lead.createdAt)
    if (when) {
      sampleDate ??= when
      const hour = getDashboardZonedParts(when).hour
      const timeLabel = formatHourWindow(hour, when)
      addBucket(timeBuckets, timeLabel, lead.formSubmitted)
    }

    const age = resolveLeadAge(lead.fields, now)
    const ageGroup = age != null ? ageGroupFromAge(age) : null
    if (ageGroup) {
      addBucket(ageGroupBuckets, ageGroup, lead.formSubmitted)
    }

    const city = pickFieldValue(lead.fields, ["city"])
    if (city) {
      addBucket(cityBuckets, city, lead.formSubmitted)
    }

    const stateRaw = pickFieldValue(lead.fields, ["state"])
    const state = stateRaw ? (normalizeUsStateName(stateRaw) ?? stateRaw) : null
    if (state) {
      addBucket(stateBuckets, state, lead.formSubmitted)
    }

    const zip = normalizeLeadZip(lead.zip)
    if (zip) addBucket(zipBuckets, zip, lead.formSubmitted)
  }

  const bestTime = pickBestBucket(timeBuckets)
  const bestAgeGroup = pickBestBucket(ageGroupBuckets)
  const bestCity = pickBestBucket(cityBuckets)
  const bestState = pickBestBucket(stateBuckets)

  // Best ZIP: highest submission count (not Wilson)
  let bestZip: BucketCounter | null = null
  for (const bucket of zipBuckets.values()) {
    if (
      !bestZip ||
      bucket.submitted > bestZip.submitted ||
      (bucket.submitted === bestZip.submitted && bucket.total > bestZip.total)
    ) {
      bestZip = bucket
    }
  }

  const totalLeads = yesCount + noCount

  return [
    {
      id: "best-time",
      label: "Best Time",
      value: bestTime ? bestTime.label : "—",
      metricLabel: "Submitted leads",
      metricValue: bestTime?.submitted ?? 0,
      sampleSize: bestTime?.total,
      submissionRate:
        bestTime && bestTime.total > 0
          ? formatPercentShare(bestTime.submitted, bestTime.total)
          : undefined,
      enoughData: (bestTime?.submitted ?? 0) > 0,
    },
    {
      id: "best-zip",
      label: "Best ZIP",
      value: bestZip?.label ?? "—",
      metricLabel: "Submitted leads",
      metricValue: bestZip?.submitted ?? 0,
      sampleSize: bestZip?.total,
      submissionRate:
        bestZip && bestZip.total > 0
          ? formatPercentShare(bestZip.submitted, bestZip.total)
          : undefined,
      enoughData: (bestZip?.submitted ?? 0) > 0,
    },
    {
      id: "form-submission-ratio",
      label: "Form Submission Ratio",
      value: totalLeads > 0 ? formatYesNoRatio(yesCount, noCount) : "—",
      breakdown: [
        { label: "Submitted", value: yesCount },
        { label: "Not submitted", value: noCount },
      ],
      enoughData: totalLeads > 0,
    },
    {
      id: "best-age-group",
      label: "Best Age Group",
      value: bestAgeGroup?.label ?? "—",
      metricLabel: "Submitted leads",
      metricValue: bestAgeGroup?.submitted ?? 0,
      sampleSize: bestAgeGroup?.total,
      submissionRate:
        bestAgeGroup && bestAgeGroup.total > 0
          ? formatPercentShare(bestAgeGroup.submitted, bestAgeGroup.total)
          : undefined,
      enoughData: (bestAgeGroup?.submitted ?? 0) > 0,
    },
    {
      id: "best-city",
      label: "Best City",
      value: bestCity?.label ?? "—",
      metricLabel: "Submitted leads",
      metricValue: bestCity?.submitted ?? 0,
      sampleSize: bestCity?.total,
      submissionRate:
        bestCity && bestCity.total > 0
          ? formatPercentShare(bestCity.submitted, bestCity.total)
          : undefined,
      enoughData: (bestCity?.submitted ?? 0) > 0,
    },
    {
      id: "best-state",
      label: "Best State",
      value: bestState?.label ?? "—",
      metricLabel: "Submitted leads",
      metricValue: bestState?.submitted ?? 0,
      sampleSize: bestState?.total,
      submissionRate:
        bestState && bestState.total > 0
          ? formatPercentShare(bestState.submitted, bestState.total)
          : undefined,
      enoughData: (bestState?.submitted ?? 0) > 0,
    },
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
      label: "Form Submission Ratio",
      value: "—",
      breakdown: [
        { label: "Submitted", value: 0 },
        { label: "Not submitted", value: 0 },
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

export function filterLevel1StatsToVisibleLeadColumns(
  stats: Level1Stat[],
  visibleLeadFieldKeys: string[]
): Level1Stat[] {
  const visibleKeys = new Set(
    visibleLeadFieldKeys.map((key) => key.trim().toLowerCase())
  )

  return stats.filter((stat) => {
    if (
      stat.id === "best-time" ||
      stat.id === "best-zip" ||
      stat.id === "form-submission-ratio"
    ) {
      return true
    }
    if (stat.id === "best-age-group") {
      return visibleKeys.has("dob")
    }
    if (stat.id === "best-city") {
      return visibleKeys.has("city")
    }
    if (stat.id === "best-state") {
      return visibleKeys.has("state")
    }
    return true
  })
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
