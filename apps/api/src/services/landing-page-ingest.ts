import { neon } from '@neondatabase/serverless'
import { createNotification } from '@workspace/database'
import { ingestHostnameMatchesLanding } from '@workspace/database/landing/normalizeLandingPageUrl'

type LandingRowLite = {
  id: string
  hostname: string
  status: string
  verifiedAt: Date | null
  publicId: string
  brandName: string
  sdkInstallStatus: string
  ownerUserId: string
}

let sqlSingleton: ReturnType<typeof neon> | null = null

function getSql(): ReturnType<typeof neon> | null {
  if (sqlSingleton) return sqlSingleton
  const url =
    process.env.DATABASE_URL ??
    process.env.POSTGRES_PRISMA_URL ??
    process.env.POSTGRES_URL
  if (!url) return null
  sqlSingleton = neon(url)
  return sqlSingleton
}

type ReconcileResult =
  | { outcome: 'skip' }
  | { outcome: 'reject'; reason: string }
  | { outcome: 'ok' }

export async function reconcileLandingPageIngest(payload: {
  lpIdRaw: string | undefined
  wid: string
  eventUrl?: string | undefined
  ev?: string
  props?: Record<string, unknown>
}): Promise<ReconcileResult> {
  const raw = payload.lpIdRaw?.trim() ?? ''
  if (!raw) {
    return { outcome: 'skip' }
  }

  const sql = getSql()
  if (!sql) {
    return { outcome: 'reject', reason: 'DATABASE_NOT_CONFIGURED' }
  }

  const rows = (await sql`
    SELECT
      lp.id,
      lp.hostname,
      lp.status,
      lp."verifiedAt",
      lp."publicId",
      lp."brandName",
      lp."sdkInstallStatus",
      w."ownerUserId"
    FROM landing_page lp
    INNER JOIN workspace w ON w.id = lp."workspaceId"
    WHERE lp."publicId" = ${raw} AND lp."deletedAt" IS NULL
    LIMIT 1
  `) as LandingRowLite[]
  const row = rows[0]
  if (!row) {
    return { outcome: 'reject', reason: 'UNKNOWN_LANDING_PAGE' }
  }

  if (row.status === 'inactive') {
    return { outcome: 'reject', reason: 'LANDING_PAGE_INACTIVE' }
  }

  if (row.id !== payload.wid) {
    return { outcome: 'reject', reason: 'WID_MISMATCH' }
  }

  if (!ingestHostnameMatchesLanding(payload.eventUrl, row.hostname)) {
    return { outcome: 'reject', reason: 'HOSTNAME_MISMATCH' }
  }

  const now = new Date()
  const nextVerifiedAt =
    row.verifiedAt != null ? new Date(row.verifiedAt) : now
  const nextStatus = row.status === 'inactive' ? 'inactive' : 'verified'
  const wasSdkDetected = row.sdkInstallStatus === 'detected'

  await sql`
    UPDATE landing_page
    SET
      "lastSeenAt" = ${now},
      "lastEventAt" = ${now},
      "sdkInstallStatus" = ${'detected'},
      "status" = ${nextStatus},
      "verifiedAt" = ${nextVerifiedAt},
      "verificationMethod" = ${'sdk_event'},
      "updatedAt" = ${now}
    WHERE id = ${row.id}
  `

  if (!wasSdkDetected) {
    try {
      await createNotification({
        userId: row.ownerUserId,
        type: 'connection',
        title: 'SDK connected',
        body: `${row.brandName} is now sending events.`,
        severity: 'info',
        landingPageId: row.id,
        landingPagePublicId: row.publicId,
        href: `/dashboard/${encodeURIComponent(row.publicId)}?tab=settings&section=tracking`,
        sourceType: 'sdk_connected',
        sourceId: row.id,
      })
    } catch {
      // Notification failure must not block ingest.
    }
  }

  return { outcome: 'ok' }
}
