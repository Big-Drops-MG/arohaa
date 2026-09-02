import {
  type DataExportDashboardData,
  type DataExportLeadRow,
} from "@/features/data-export/model/data-export"
import {
  computeLevel1StatsFromLeads,
  emptyLevel1Stats,
  hasCompleteLevel1Stats,
  type Level1Stat,
} from "@/features/data-lab/model/level1"
import {
  computeLevel2StatsFromLeads,
  emptyLevel2Stats,
  type Level2Stat,
} from "@/features/data-lab/model/level2"
import type { OverviewDateRangeId } from "@/features/overview/model/overview"
import type { DashboardCustomRange } from "@/features/traffic/model/traffic-range"
import { buildAnalyticsApiPath } from "@/lib/dashboard/analytics-query"

const LEVEL1_PAGE_SIZE = 50
/** Bounded so the fallback cannot exhaust the analytics rate limit. */
const LEVEL1_MAX_PAGES = 40
const LEVEL1_FETCH_CONCURRENCY = 4

export type DataLabStatsBundle = {
  level1Stats: Level1Stat[]
  level2Stats: Level2Stat[]
}

export function isLeadFormSubmittedFlag(value: unknown): boolean {
  if (value === true || value === 1) return true
  if (value === false || value === 0 || value == null) return false
  if (typeof value === "number") return value > 0
  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase()
    return normalized === "1" || normalized === "true" || normalized === "yes"
  }
  return false
}

export function mapDataExportLeadRow(
  raw: Record<string, unknown>
): DataExportLeadRow {
  const fieldsRaw = raw.fields
  const fields =
    fieldsRaw && typeof fieldsRaw === "object" && !Array.isArray(fieldsRaw)
      ? Object.fromEntries(
          Object.entries(fieldsRaw as Record<string, unknown>).map(
            ([key, value]) => [key, String(value ?? "")]
          )
        )
      : {}

  return {
    sessionId: String(raw.sessionId ?? raw.session_id ?? ""),
    macId: String(raw.macId ?? raw.mac_id ?? ""),
    createdAt: String(raw.createdAt ?? raw.created_at ?? ""),
    submittedAt: (() => {
      const value = raw.submittedAt ?? raw.submitted_at
      if (value == null || value === "") return null
      return String(value)
    })(),
    zip: String(raw.zip ?? ""),
    email: String(raw.email ?? ""),
    utmSource: String(raw.utmSource ?? raw.utm_source ?? ""),
    utmId: String(raw.utmId ?? raw.utm_id ?? ""),
    trustedFormUrl: String(raw.trustedFormUrl ?? raw.trusted_form_url ?? ""),
    formSubmitted: isLeadFormSubmittedFlag(
      raw.formSubmitted ?? raw.form_submitted
    ),
    fields,
  }
}

function statsFromLeads(leads: DataExportLeadRow[]): DataLabStatsBundle {
  if (leads.length === 0) {
    return {
      level1Stats: emptyLevel1Stats(),
      level2Stats: emptyLevel2Stats(),
    }
  }
  return {
    level1Stats: computeLevel1StatsFromLeads(leads),
    level2Stats: computeLevel2StatsFromLeads(leads),
  }
}

export function level1StatsFromExportPayload(
  payload: Pick<
    DataExportDashboardData,
    "leads" | "level1Stats" | "level1Complete"
  >
): Level1Stat[] {
  if (payload.level1Complete && hasCompleteLevel1Stats(payload.level1Stats)) {
    return payload.level1Stats
  }
  if (payload.leads?.length) {
    return computeLevel1StatsFromLeads(payload.leads)
  }
  return emptyLevel1Stats()
}

export function level2StatsFromExportPayload(
  payload: Pick<
    DataExportDashboardData,
    "leads" | "level2Stats" | "level2Complete"
  >
): Level2Stat[] {
  if (payload.level2Complete && Array.isArray(payload.level2Stats)) {
    return payload.level2Stats
  }
  if (payload.leads?.length) {
    return computeLevel2StatsFromLeads(payload.leads)
  }
  return emptyLevel2Stats()
}

export function dataLabStatsFromExportPayload(
  payload: Pick<
    DataExportDashboardData,
    | "leads"
    | "level1Stats"
    | "level1Complete"
    | "level2Stats"
    | "level2Complete"
  >
): DataLabStatsBundle {
  return {
    level1Stats: level1StatsFromExportPayload(payload),
    level2Stats: level2StatsFromExportPayload(payload),
  }
}

type Level1PagePayload = DataExportDashboardData & {
  leads?: Array<Record<string, unknown>>
}

async function fetchDataExportPage({
  projectId,
  dateRangeId,
  customRange,
  limit,
  offset,
  signal,
}: {
  projectId: string
  dateRangeId: OverviewDateRangeId
  customRange?: DashboardCustomRange
  limit: number
  offset: number
  signal?: AbortSignal
}): Promise<Level1PagePayload> {
  const path = buildAnalyticsApiPath(
    `/api/landing-pages/${encodeURIComponent(projectId)}/data-export`,
    { rangeId: dateRangeId, customRange }
  )
  const url = new URL(path, "http://local.invalid")
  url.searchParams.set("limit", String(limit))
  url.searchParams.set("offset", String(offset))

  const res = await fetch(`${url.pathname}${url.search}`, {
    cache: "no-store",
    signal,
    priority: "high",
  } as RequestInit & { priority: "high" })
  if (!res.ok) {
    throw new Error(`data-export ${res.status}`)
  }

  return (await res.json()) as Level1PagePayload
}

function apiStatsComplete(
  payload: Pick<
    DataExportDashboardData,
    "level1Stats" | "level1Complete" | "level2Stats" | "level2Complete"
  >
): DataLabStatsBundle | null {
  if (
    payload.level1Complete &&
    hasCompleteLevel1Stats(payload.level1Stats) &&
    payload.level2Complete &&
    Array.isArray(payload.level2Stats)
  ) {
    return {
      level1Stats: payload.level1Stats,
      level2Stats: payload.level2Stats,
    }
  }
  return null
}

/**
 * Returns range-wide Level 1 + Level 2 stats from the leads table.
 * Uses API complete stats when present; otherwise walks pages in parallel and
 * reports progressive partial stats so the UI can paint after the first page.
 */
export async function fetchDataLabStatsFromLeadsTable({
  projectId,
  dateRangeId,
  customRange,
  signal,
  seed,
  onProgress,
}: {
  projectId: string
  dateRangeId: OverviewDateRangeId
  customRange?: DashboardCustomRange
  signal?: AbortSignal
  seed?: Pick<
    DataExportDashboardData,
    | "leads"
    | "level1Stats"
    | "level1Complete"
    | "level2Stats"
    | "level2Complete"
    | "total"
    | "limit"
    | "offset"
    | "hasMore"
  > | null
  onProgress?: (stats: DataLabStatsBundle) => void
}): Promise<DataLabStatsBundle> {
  if (seed) {
    const complete = apiStatsComplete(seed)
    if (complete) return complete
  }

  const allLeads: DataExportLeadRow[] = []
  const seen = new Set<string>()

  const pushLeads = (rows: DataExportLeadRow[]) => {
    for (const lead of rows) {
      const key =
        lead.sessionId || `${lead.createdAt}:${lead.zip}:${lead.email}`
      if (seen.has(key)) continue
      seen.add(key)
      allLeads.push(lead)
    }
  }

  const publish = () => {
    if (allLeads.length === 0) return
    onProgress?.(statsFromLeads(allLeads))
  }

  if (seed?.leads?.length) {
    pushLeads(seed.leads)
    publish()
    if (!seed.hasMore) return statsFromLeads(allLeads)
  }

  if (seed?.hasMore && (seed.total ?? 0) > allLeads.length) {
    const firstOffset = (seed.offset ?? 0) + (seed.limit || seed.leads.length)
    const maxOffset = Math.min(
      seed.total ?? allLeads.length,
      LEVEL1_MAX_PAGES * LEVEL1_PAGE_SIZE
    )
    const offsets: number[] = []
    for (
      let offset = firstOffset;
      offset < maxOffset && offsets.length < LEVEL1_MAX_PAGES;
      offset += LEVEL1_PAGE_SIZE
    ) {
      offsets.push(offset)
    }

    for (let i = 0; i < offsets.length; i += LEVEL1_FETCH_CONCURRENCY) {
      if (signal?.aborted) break
      const pages = await Promise.all(
        offsets.slice(i, i + LEVEL1_FETCH_CONCURRENCY).map((offset) =>
          fetchDataExportPage({
            projectId,
            dateRangeId,
            customRange,
            limit: LEVEL1_PAGE_SIZE,
            offset,
            signal,
          })
        )
      )
      for (const page of pages) {
        const complete = apiStatsComplete(page)
        if (complete) return complete
        pushLeads(
          (page.leads ?? []).map((lead) =>
            mapDataExportLeadRow(lead as Record<string, unknown>)
          )
        )
      }
      publish()
    }

    return statsFromLeads(allLeads)
  }

  const first = await fetchDataExportPage({
    projectId,
    dateRangeId,
    customRange,
    limit: LEVEL1_PAGE_SIZE,
    offset: seed?.leads?.length
      ? (seed.offset ?? 0) + (seed.limit || seed.leads.length)
      : 0,
    signal,
  })

  const firstComplete = apiStatsComplete(first)
  if (firstComplete) return firstComplete

  pushLeads(
    (first.leads ?? []).map((lead) =>
      mapDataExportLeadRow(lead as Record<string, unknown>)
    )
  )
  publish()

  const pageLimit = first.limit || LEVEL1_PAGE_SIZE
  const total = first.total ?? allLeads.length
  const startOffset = (first.offset ?? 0) + pageLimit
  const maxOffset = Math.min(total, LEVEL1_MAX_PAGES * LEVEL1_PAGE_SIZE)

  if (!first.hasMore || startOffset >= maxOffset) {
    return statsFromLeads(allLeads)
  }

  const offsets: number[] = []
  for (
    let offset = startOffset;
    offset < maxOffset && offsets.length + 1 < LEVEL1_MAX_PAGES;
    offset += pageLimit
  ) {
    offsets.push(offset)
  }

  for (let i = 0; i < offsets.length; i += LEVEL1_FETCH_CONCURRENCY) {
    if (signal?.aborted) break
    const batch = offsets.slice(i, i + LEVEL1_FETCH_CONCURRENCY)
    const pages = await Promise.all(
      batch.map((offset) =>
        fetchDataExportPage({
          projectId,
          dateRangeId,
          customRange,
          limit: pageLimit,
          offset,
          signal,
        })
      )
    )

    for (const page of pages) {
      const complete = apiStatsComplete(page)
      if (complete) return complete
      pushLeads(
        (page.leads ?? []).map((lead) =>
          mapDataExportLeadRow(lead as Record<string, unknown>)
        )
      )
    }
    publish()
  }

  return statsFromLeads(allLeads)
}
