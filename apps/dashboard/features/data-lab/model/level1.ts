import type { DataExportLeadRow } from "@/features/data-export/model/data-export"
import {
  getDashboardZonedParts,
  getDashboardTimezoneAbbreviation,
} from "@/lib/datetime"

export type Level1Stat = {
  id: string
  label: string
  value: string
  metricLabel?: string
  metricValue?: number
  enoughData: boolean
}

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

export function computeLevel1StatsFromLeads(
  leads: DataExportLeadRow[]
): Level1Stat[] {
  const hourCounts = new Map<number, number>()
  let sampleDate: Date | null = null

  for (const lead of leads) {
    if (!lead.formSubmitted) continue
    const when = parseLeadWhen(lead.createdAt)
    if (!when) continue
    sampleDate ??= when
    const hour = getDashboardZonedParts(when).hour
    hourCounts.set(hour, (hourCounts.get(hour) ?? 0) + 1)
  }

  let bestHour = -1
  let bestCount = 0
  for (const [hour, count] of hourCounts) {
    if (count > bestCount) {
      bestHour = hour
      bestCount = count
    }
  }

  return [
    {
      id: "best-time",
      label: "Best Time",
      value:
        bestCount > 0 && bestHour >= 0 && sampleDate
          ? formatHourWindow(bestHour, sampleDate)
          : "—",
      metricLabel: "Form submissions",
      metricValue: bestCount,
      enoughData: bestCount > 0,
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
  ]
}

export type Level1Payload = {
  section: "level1"
  stats: Level1Stat[]
}

export function emptyLevel1Payload(): Level1Payload {
  return { section: "level1", stats: emptyLevel1Stats() }
}

/** Prefer full-set stats; otherwise derive from the provided lead rows. */
export function resolveLevel1Stats(
  level1Stats: Level1Stat[] | undefined,
  leads: DataExportLeadRow[]
): Level1Stat[] {
  const computed = computeLevel1StatsFromLeads(leads)
  if (computed[0]?.enoughData) return computed
  if (level1Stats?.[0]?.enoughData) return level1Stats
  return computed
}
