import {
  type DataExportDashboardData,
  type DataExportLeadRow,
} from "@/features/data-export/model/data-export"
import {
  computeLevel1StatsFromLeads,
  emptyLevel1Stats,
  type Level1Stat,
} from "@/features/data-lab/model/level1"
import type { OverviewDateRangeId } from "@/features/overview/model/overview"
import type { DashboardCustomRange } from "@/features/traffic/model/traffic-range"
import { buildAnalyticsApiPath } from "@/lib/dashboard/analytics-query"

const LEVEL1_PAGE_SIZE = 50
const LEVEL1_MAX_PAGES = 400

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

/**
 * Loads every leads-table page for the range and derives Level 1 stats from
 * those rows (When + Form Submitted). Same source as the Leads Table tab.
 */
export async function fetchLevel1StatsFromLeadsTable({
  projectId,
  dateRangeId,
  customRange,
  signal,
}: {
  projectId: string
  dateRangeId: OverviewDateRangeId
  customRange?: DashboardCustomRange
  signal?: AbortSignal
}): Promise<Level1Stat[]> {
  const allLeads: DataExportLeadRow[] = []
  let offset = 0

  for (let page = 0; page < LEVEL1_MAX_PAGES; page++) {
    if (signal?.aborted) break

    const path = buildAnalyticsApiPath(
      `/api/landing-pages/${encodeURIComponent(projectId)}/data-export`,
      { rangeId: dateRangeId, customRange }
    )
    const url = new URL(path, "http://local.invalid")
    url.searchParams.set("limit", String(LEVEL1_PAGE_SIZE))
    url.searchParams.set("offset", String(offset))

    const res = await fetch(`${url.pathname}${url.search}`, {
      cache: "no-store",
      signal,
    })
    if (!res.ok) {
      throw new Error(`data-export ${res.status}`)
    }

    const payload = (await res.json()) as DataExportDashboardData & {
      leads?: Array<Record<string, unknown>>
    }

    const pageLeads = (payload.leads ?? []).map((lead) =>
      mapDataExportLeadRow(lead as Record<string, unknown>)
    )
    allLeads.push(...pageLeads)

    const pageLimit = payload.limit || LEVEL1_PAGE_SIZE
    const pageOffset = payload.offset ?? offset
    const hasMore = Boolean(payload.hasMore)
    if (!hasMore || pageLeads.length === 0) break
    offset = pageOffset + pageLimit
  }

  if (allLeads.length === 0) return emptyLevel1Stats()
  return computeLevel1StatsFromLeads(allLeads)
}
