import { getClickHouseClient } from '../../services/clickhouse.service.js'
import type { PageIntegrityBaseline } from './page-integrity.js'

export const PAGE_INTEGRITY_BASELINE_TABLE = 'page_integrity_baseline'

export type StoredPageIntegrityBaseline = PageIntegrityBaseline & {
  landingPageId: string
  version: number
  status: 'draft' | 'approved' | 'retired'
  approvedAt: string
  approvedBy: string
  notAssessedReason?: string
}

export async function ensurePageIntegrityBaselineTable(): Promise<void> {
  const ch = getClickHouseClient()
  await ch.command({
    query: `
      CREATE TABLE IF NOT EXISTS ${PAGE_INTEGRITY_BASELINE_TABLE} (
          landing_page_id String,
          version UInt32,
          status LowCardinality(String) DEFAULT 'draft',
          script_origins Array(String),
          form_actions Array(String),
          iframe_origins Array(String),
          approved_at DateTime64(3, 'UTC') DEFAULT toDateTime64(0, 3, 'UTC'),
          approved_by String DEFAULT '',
          updated_at DateTime64(3, 'UTC') DEFAULT now64(3, 'UTC')
      ) ENGINE = ReplacingMergeTree(updated_at)
      ORDER BY (landing_page_id, version)
    `,
  })
}

function toChDateTime(date = new Date()): string {
  const pad = (n: number, w = 2) => String(n).padStart(w, '0')
  return `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())} ${pad(date.getUTCHours())}:${pad(date.getUTCMinutes())}:${pad(date.getUTCSeconds())}.${pad(date.getUTCMilliseconds(), 3)}`
}

export async function upsertPageIntegrityBaseline(input: {
  landingPageId: string
  version?: number
  status: 'draft' | 'approved' | 'retired'
  scriptOrigins: string[]
  formActions: string[]
  iframeOrigins: string[]
  approvedBy?: string
}): Promise<StoredPageIntegrityBaseline> {
  await ensurePageIntegrityBaselineTable()
  const version =
    input.version ??
    (await nextBaselineVersion(input.landingPageId))
  const ch = getClickHouseClient()
  const approvedAt =
    input.status === 'approved' ? toChDateTime() : '1970-01-01 00:00:00.000'
  await ch.insert({
    table: PAGE_INTEGRITY_BASELINE_TABLE,
    values: [
      {
        landing_page_id: input.landingPageId,
        version,
        status: input.status,
        script_origins: input.scriptOrigins,
        form_actions: input.formActions,
        iframe_origins: input.iframeOrigins,
        approved_at: approvedAt,
        approved_by: input.approvedBy ?? '',
        updated_at: toChDateTime(),
      },
    ],
    format: 'JSONEachRow',
  })
  return {
    landingPageId: input.landingPageId,
    version,
    status: input.status,
    scriptOrigins: input.scriptOrigins,
    formActions: input.formActions,
    iframeOrigins: input.iframeOrigins,
    approvedAt,
    approvedBy: input.approvedBy ?? '',
  }
}

async function nextBaselineVersion(landingPageId: string): Promise<number> {
  const ch = getClickHouseClient()
  const res = await ch.query({
    query: `
      SELECT max(version) AS v
      FROM ${PAGE_INTEGRITY_BASELINE_TABLE} FINAL
      WHERE landing_page_id = {landingPageId:String}
    `,
    query_params: { landingPageId },
    format: 'JSON',
  })
  const json = (await res.json()) as { data: Array<{ v: string | number }> }
  const current = Number(json.data?.[0]?.v ?? 0)
  return Number.isFinite(current) ? current + 1 : 1
}

export async function loadApprovedPageIntegrityBaseline(
  landingPageId: string,
): Promise<
  | { status: 'approved'; baseline: StoredPageIntegrityBaseline }
  | { status: 'not_assessed'; reason: string }
> {
  const id = landingPageId.trim()
  if (!id) {
    return { status: 'not_assessed', reason: 'landing_page_missing' }
  }
  try {
    await ensurePageIntegrityBaselineTable()
    const ch = getClickHouseClient()
    const res = await ch.query({
      query: `
        SELECT
          landing_page_id,
          version,
          status,
          script_origins,
          form_actions,
          iframe_origins,
          approved_at,
          approved_by
        FROM ${PAGE_INTEGRITY_BASELINE_TABLE} FINAL
        WHERE landing_page_id = {landingPageId:String}
          AND status = 'approved'
        ORDER BY version DESC
        LIMIT 1
      `,
      query_params: { landingPageId: id },
      format: 'JSON',
    })
    const json = (await res.json()) as {
      data: Array<{
        landing_page_id: string
        version: number
        status: string
        script_origins: string[]
        form_actions: string[]
        iframe_origins: string[]
        approved_at: string
        approved_by: string
      }>
    }
    const row = json.data?.[0]
    if (!row) {
      return {
        status: 'not_assessed',
        reason: 'no_approved_baseline',
      }
    }
    return {
      status: 'approved',
      baseline: {
        landingPageId: row.landing_page_id,
        version: Number(row.version) || 1,
        status: 'approved',
        scriptOrigins: row.script_origins ?? [],
        formActions: row.form_actions ?? [],
        iframeOrigins: row.iframe_origins ?? [],
        approvedAt: row.approved_at,
        approvedBy: row.approved_by,
      },
    }
  } catch {
    return { status: 'not_assessed', reason: 'baseline_lookup_failed' }
  }
}
