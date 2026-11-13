import { and, desc, eq, gte, inArray, isNotNull, lt, sql } from "drizzle-orm"
import {
  callCenterLeadOutcomes,
  callCenterSourceRollups,
  callCenterUploads,
  db,
} from "@workspace/database"
import {
  normalizeDashboardUtmFilter,
  type DashboardUtmFilter,
} from "@/features/dashboard/model/utm-attribution-filter"
import {
  normalizeCallCenterSid,
  parseCallCenterCsv,
  type CallCenterOutcomesPayload,
  type CallCenterSourceRollupRow,
  type CallCenterUploadSummary,
} from "@/features/data-lab/model/call-center-csv"
import {
  parseTrafficRangeId,
  type DashboardCustomRange,
} from "@/features/traffic/model/traffic-range"
import { resolveUtmFilterForActor } from "@/lib/server/analytics-utm-params"
import { canAccessLeadsForLandingPage } from "@/lib/server/data-export-acl"
import { requireLandingPageActor } from "@/lib/server/landing-auth"
import { getActiveLandingPageForActor } from "@/lib/server/landing-pages-store"
import { resolveNotificationCenterAnalyticsWindow } from "@/lib/server/web-push-analytics-range"

const INSERT_CHUNK = 400
const MAX_UPLOAD_BYTES = 8 * 1024 * 1024

export type { CallCenterOutcomesPayload, CallCenterUploadSummary }

async function requireLandingAccess(publicId: string) {
  const actor = await requireLandingPageActor()
  if (!actor) return { ok: false as const, status: 401, error: "Unauthorized" }
  if (!(await canAccessLeadsForLandingPage(actor, publicId))) {
    return { ok: false as const, status: 403, error: "Forbidden" }
  }
  const row = await getActiveLandingPageForActor(actor.id, publicId)
  if (!row) return { ok: false as const, status: 404, error: "Not found" }
  return { ok: true as const, actor, row }
}

function emptyTotals() {
  return {
    leads: 0,
    contacted: 0,
    transferred: 0,
    duration15m: 0,
    duration20m: 0,
    duplicates: 0,
  }
}

export async function loadCallCenterOutcomes(
  landingPagePublicId: string,
  rangeIdRaw?: string | null,
  customRange?: DashboardCustomRange | null,
  utmFilter?: DashboardUtmFilter | null
): Promise<
  | { ok: true; data: CallCenterOutcomesPayload }
  | { ok: false; status: number; error: string }
> {
  const access = await requireLandingAccess(landingPagePublicId)
  if (!access.ok) return access

  const rangeId = parseTrafficRangeId(rangeIdRaw)
  const window = resolveNotificationCenterAnalyticsWindow(
    rangeId,
    new Date(),
    customRange
  )
  const scopedUtm = await resolveUtmFilterForActor(
    access.actor,
    landingPagePublicId,
    utmFilter
  )
  const normalizedUtm = normalizeDashboardUtmFilter(scopedUtm)
  const sidFilter = normalizedUtm?.utm_source?.filter(Boolean) ?? []

  const outcomeFilters = [
    eq(callCenterLeadOutcomes.landingPageId, access.row.id),
    isNotNull(callCenterLeadOutcomes.occurredAt),
    gte(callCenterLeadOutcomes.occurredAt, window.start),
    lt(callCenterLeadOutcomes.occurredAt, window.end),
  ]
  if (sidFilter.length > 0) {
    outcomeFilters.push(inArray(callCenterLeadOutcomes.sid, sidFilter))
  }

  const [uploads, rollups] = await Promise.all([
    db
      .select({
        id: callCenterUploads.id,
        fileName: callCenterUploads.fileName,
        rowCount: callCenterUploads.rowCount,
        contactedCount: callCenterUploads.contactedCount,
        transferredCount: callCenterUploads.transferredCount,
        duplicateCount: callCenterUploads.duplicateCount,
        createdAt: callCenterUploads.createdAt,
      })
      .from(callCenterUploads)
      .where(eq(callCenterUploads.landingPageId, access.row.id))
      .orderBy(desc(callCenterUploads.createdAt))
      .limit(20),
    db
      .select({
        sid: sql<string>`CASE WHEN ${callCenterLeadOutcomes.sid} = '' THEN '—' ELSE ${callCenterLeadOutcomes.sid} END`,
        leads: sql<number>`count(*)::int`,
        contacted: sql<number>`sum(CASE WHEN ${callCenterLeadOutcomes.ccContacted} THEN 1 ELSE 0 END)::int`,
        transferred: sql<number>`sum(CASE WHEN ${callCenterLeadOutcomes.ccTransferred} THEN 1 ELSE 0 END)::int`,
        duration15m: sql<number>`sum(CASE WHEN ${callCenterLeadOutcomes.duration15m} THEN 1 ELSE 0 END)::int`,
        duration20m: sql<number>`sum(CASE WHEN ${callCenterLeadOutcomes.duration20m} THEN 1 ELSE 0 END)::int`,
        duplicates: sql<number>`sum(CASE WHEN ${callCenterLeadOutcomes.duplicate} THEN 1 ELSE 0 END)::int`,
      })
      .from(callCenterLeadOutcomes)
      .where(and(...outcomeFilters))
      .groupBy(
        sql`CASE WHEN ${callCenterLeadOutcomes.sid} = '' THEN '—' ELSE ${callCenterLeadOutcomes.sid} END`
      )
      .orderBy(sql`count(*) DESC`),
  ])

  const sources: CallCenterSourceRollupRow[] = rollups.map((row) => {
    const leads = Number(row.leads) || 0
    const contacted = Number(row.contacted) || 0
    const transferred = Number(row.transferred) || 0
    return {
      sid: row.sid || "—",
      leads,
      contacted,
      transferred,
      duration15m: Number(row.duration15m) || 0,
      duration20m: Number(row.duration20m) || 0,
      duplicates: Number(row.duplicates) || 0,
      contactRate: leads > 0 ? contacted / leads : 0,
      transferRate: leads > 0 ? transferred / leads : 0,
    }
  })

  const totals = sources.reduce((acc, row) => {
    acc.leads += row.leads
    acc.contacted += row.contacted
    acc.transferred += row.transferred
    acc.duration15m += row.duration15m
    acc.duration20m += row.duration20m
    acc.duplicates += row.duplicates
    return acc
  }, emptyTotals())

  return {
    ok: true,
    data: {
      uploads: uploads.map((upload) => ({
        id: upload.id,
        fileName: upload.fileName,
        rowCount: upload.rowCount,
        contactedCount: upload.contactedCount,
        transferredCount: upload.transferredCount,
        duplicateCount: upload.duplicateCount,
        createdAt: upload.createdAt.toISOString(),
      })),
      sources,
      totals,
    },
  }
}

async function refreshSourceRollups(landingPageId: string): Promise<void> {
  await db
    .delete(callCenterSourceRollups)
    .where(eq(callCenterSourceRollups.landingPageId, landingPageId))

  const grouped = await db
    .select({
      sid: sql<string>`CASE WHEN ${callCenterLeadOutcomes.sid} = '' THEN '—' ELSE ${callCenterLeadOutcomes.sid} END`,
      leads: sql<number>`count(*)::int`,
      contacted: sql<number>`sum(CASE WHEN ${callCenterLeadOutcomes.ccContacted} THEN 1 ELSE 0 END)::int`,
      transferred: sql<number>`sum(CASE WHEN ${callCenterLeadOutcomes.ccTransferred} THEN 1 ELSE 0 END)::int`,
      duration15m: sql<number>`sum(CASE WHEN ${callCenterLeadOutcomes.duration15m} THEN 1 ELSE 0 END)::int`,
      duration20m: sql<number>`sum(CASE WHEN ${callCenterLeadOutcomes.duration20m} THEN 1 ELSE 0 END)::int`,
      duplicates: sql<number>`sum(CASE WHEN ${callCenterLeadOutcomes.duplicate} THEN 1 ELSE 0 END)::int`,
    })
    .from(callCenterLeadOutcomes)
    .where(eq(callCenterLeadOutcomes.landingPageId, landingPageId))
    .groupBy(
      sql`CASE WHEN ${callCenterLeadOutcomes.sid} = '' THEN '—' ELSE ${callCenterLeadOutcomes.sid} END`
    )

  if (grouped.length === 0) return

  await db.insert(callCenterSourceRollups).values(
    grouped.map((row) => ({
      landingPageId,
      sid: row.sid || "—",
      leads: Number(row.leads) || 0,
      contacted: Number(row.contacted) || 0,
      transferred: Number(row.transferred) || 0,
      duration15m: Number(row.duration15m) || 0,
      duration20m: Number(row.duration20m) || 0,
      duplicates: Number(row.duplicates) || 0,
      updatedAt: new Date(),
    }))
  )
}

export async function ingestCallCenterCsv(input: {
  landingPagePublicId: string
  fileName: string
  csvText: string
  byteLength: number
}): Promise<
  | {
      ok: true
      data: {
        uploadId: string
        rowCount: number
        upserted: number
        parseErrors: string[]
        sources: CallCenterSourceRollupRow[]
      }
    }
  | { ok: false; status: number; error: string }
> {
  if (input.byteLength > MAX_UPLOAD_BYTES) {
    return { ok: false, status: 413, error: "File too large (max 8MB)." }
  }

  const access = await requireLandingAccess(input.landingPagePublicId)
  if (!access.ok) return access

  const parsed = parseCallCenterCsv(input.csvText)
  if (parsed.rows.length === 0) {
    return {
      ok: false,
      status: 400,
      error: parsed.errors[0] || "No valid rows found.",
    }
  }

  const contactedCount = parsed.rows.filter((row) => row.ccContacted).length
  const transferredCount = parsed.rows.filter((row) => row.ccTransferred).length
  const duplicateCount = parsed.rows.filter((row) => row.duplicate).length
  const uploadId = crypto.randomUUID()

  await db.insert(callCenterUploads).values({
    id: uploadId,
    workspaceId: access.row.workspaceId,
    landingPageId: access.row.id,
    fileName: input.fileName.slice(0, 240),
    rowCount: parsed.rows.length,
    contactedCount,
    transferredCount,
    duplicateCount,
    uploadedByUserId: access.actor.id,
  })

  let upserted = 0
  for (let i = 0; i < parsed.rows.length; i += INSERT_CHUNK) {
    const chunk = parsed.rows.slice(i, i + INSERT_CHUNK)
    const values = chunk.map((row) => ({
      id: crypto.randomUUID(),
      workspaceId: access.row.workspaceId,
      landingPageId: access.row.id,
      uploadId,
      externalLeadId: row.externalLeadId.slice(0, 64),
      sid: row.sid.slice(0, 100),
      tid: row.tid.slice(0, 128),
      uid: row.uid.slice(0, 128),
      sub1: row.sub1.slice(0, 256),
      leadType: row.leadType.slice(0, 64),
      state: row.state.slice(0, 16),
      homeowner: row.homeowner,
      insured: row.insured,
      vehicles: row.vehicles.slice(0, 16),
      status: row.status.slice(0, 64),
      duplicate: row.duplicate,
      ccContacted: row.ccContacted,
      ccDisposition: row.ccDisposition.slice(0, 120),
      ccTransferred: row.ccTransferred,
      duration15m: row.duration15m,
      duration20m: row.duration20m,
      occurredAt: row.occurredAt,
      updatedAt: new Date(),
    }))

    await db
      .insert(callCenterLeadOutcomes)
      .values(values)
      .onConflictDoUpdate({
        target: [
          callCenterLeadOutcomes.landingPageId,
          callCenterLeadOutcomes.externalLeadId,
        ],
        set: {
          uploadId: sql`excluded."uploadId"`,
          sid: sql`excluded."sid"`,
          tid: sql`excluded."tid"`,
          uid: sql`excluded."uid"`,
          sub1: sql`excluded."sub1"`,
          leadType: sql`excluded."leadType"`,
          state: sql`excluded."state"`,
          homeowner: sql`excluded."homeowner"`,
          insured: sql`excluded."insured"`,
          vehicles: sql`excluded."vehicles"`,
          status: sql`excluded."status"`,
          duplicate: sql`excluded."duplicate"`,
          ccContacted: sql`excluded."ccContacted"`,
          ccDisposition: sql`excluded."ccDisposition"`,
          ccTransferred: sql`excluded."ccTransferred"`,
          duration15m: sql`excluded."duration15m"`,
          duration20m: sql`excluded."duration20m"`,
          occurredAt: sql`excluded."occurredAt"`,
          updatedAt: sql`excluded."updatedAt"`,
        },
      })
    upserted += chunk.length
  }

  await refreshSourceRollups(access.row.id)

  const rollups = await db
    .select()
    .from(callCenterSourceRollups)
    .where(eq(callCenterSourceRollups.landingPageId, access.row.id))
    .orderBy(desc(callCenterSourceRollups.leads))

  return {
    ok: true,
    data: {
      uploadId,
      rowCount: parsed.rows.length,
      upserted,
      parseErrors: parsed.errors.slice(0, 20),
      sources: rollups.map((row) => ({
        sid: normalizeCallCenterSid(row.sid),
        leads: row.leads,
        contacted: row.contacted,
        transferred: row.transferred,
        duration15m: row.duration15m,
        duration20m: row.duration20m,
        duplicates: row.duplicates,
        contactRate: row.leads > 0 ? row.contacted / row.leads : 0,
        transferRate: row.leads > 0 ? row.transferred / row.leads : 0,
      })),
    },
  }
}
