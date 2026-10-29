import { formatClickHouseDateTime } from './analytics-range.js'

export const ALL_TIME_DISPLAYABLE_TTL_SEC = 7 * 24 * 60 * 60
export const ALL_TIME_DISPLAYABLE_STALE_SEC = 24 * 60 * 60
export const ALL_TIME_INCREMENTAL_OVERLAP_MS = 15 * 60 * 1000

export type DisplayableLeadSnapshotRow = {
  sessionId: string
  createdAt: string
  submittedAt: string | null
  zip: string
  clientIp: string
  email: string
  utmSource: string
  utmId: string
  utmS1: string
  trustedFormUrl: string
  formSubmitted: boolean
  returnCount: number
  fields: Record<string, string>
  macId: string
}

export type DisplayableLeadsSnapshot = {
  watermark: string
  leads: DisplayableLeadSnapshotRow[]
}

export function displayableLeadsWatermark(
  leads: Array<{ createdAt?: string | null }>,
): string {
  let max = ''
  for (const lead of leads) {
    const value = (lead.createdAt || '').trim()
    if (value && value > max) max = value
  }
  return max
}

export function subtractMsFromClickHouseTimestamp(
  timestamp: string,
  ms: number,
): string {
  const trimmed = timestamp.trim()
  if (!trimmed) return trimmed
  const normalized = trimmed.includes('T')
    ? trimmed
    : `${trimmed.replace(' ', 'T')}${/[zZ]|[+-]\d{2}:?\d{2}$/.test(trimmed) ? '' : 'Z'}`
  const date = new Date(normalized)
  if (Number.isNaN(date.getTime())) return trimmed
  return formatClickHouseDateTime(new Date(date.getTime() - ms))
}

export function mergeDisplayableLeadsBySession<
  T extends { sessionId: string; createdAt?: string | null },
>(existing: T[], incoming: T[], maxSessions: number): T[] {
  const byKey = new Map<string, T>()
  for (const lead of existing) {
    if (!lead.sessionId) continue
    byKey.set(lead.sessionId, lead)
  }
  for (const lead of incoming) {
    if (!lead.sessionId) continue
    const prev = byKey.get(lead.sessionId)
    if (!prev) {
      byKey.set(lead.sessionId, lead)
      continue
    }
    const cmp = (lead.createdAt || '').localeCompare(prev.createdAt || '')
    if (cmp >= 0) byKey.set(lead.sessionId, lead)
  }

  return [...byKey.values()]
    .sort((a, b) => {
      const at = (a.createdAt || '').trim()
      const bt = (b.createdAt || '').trim()
      if (!at && bt) return 1
      if (at && !bt) return -1
      if (at !== bt) return bt.localeCompare(at)
      return a.sessionId.localeCompare(b.sessionId)
    })
    .slice(0, Math.max(1, maxSessions))
}

export function allTimeDisplayableCacheKey(
  workspaceId: string,
  utmKey: string,
  returningOnly: boolean,
): string {
  return `analytics:funnel-leads:displayable:v1:${workspaceId}:${utmKey}:${returningOnly ? 'r1' : 'r0'}`
}
