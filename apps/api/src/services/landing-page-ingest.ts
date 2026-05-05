import { neon } from '@neondatabase/serverless'
import { ingestHostnameMatchesLanding } from '@workspace/database/landing/normalizeLandingPageUrl'

type LandingRowLite = {
  id: string
  hostname: string
  status: string
  verifiedAt: Date | null
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
    SELECT id, hostname, status, "verifiedAt"
    FROM landing_page
    WHERE "publicId" = ${raw} AND "deletedAt" IS NULL
    LIMIT 1
  `) as LandingRowLite[]
  const row = rows[0]
  if (!row) {
    return { outcome: 'reject', reason: 'UNKNOWN_LANDING_PAGE' }
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

  return { outcome: 'ok' }
}
