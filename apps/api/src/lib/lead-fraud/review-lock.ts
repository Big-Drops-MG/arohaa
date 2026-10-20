import { randomUUID } from 'node:crypto'
import { redis } from '../../services/redis.service.js'

const LOCK_TTL_SEC = 20
const REVISION_CLAIM_TTL_SEC = 60 * 60 * 24 * 365

const RELEASE_LOCK_LUA = `
if redis.call("get", KEYS[1]) == ARGV[1] then
  return redis.call("del", KEYS[1])
else
  return 0
end
`

function lockKey(
  tenantWorkspaceId: string,
  workspaceId: string,
  sessionId: string,
): string {
  return `lead_review:lock:${tenantWorkspaceId}:${workspaceId}:${sessionId}`
}

function revisionClaimKey(
  tenantWorkspaceId: string,
  workspaceId: string,
  sessionId: string,
  nextRevision: number,
): string {
  return `lead_review:rev:${tenantWorkspaceId}:${workspaceId}:${sessionId}:${nextRevision}`
}

export async function withLeadReviewLock<T>(input: {
  tenantWorkspaceId: string
  workspaceId: string
  sessionId: string
  run: () => Promise<T>
}): Promise<T> {
  const key = lockKey(
    input.tenantWorkspaceId,
    input.workspaceId,
    input.sessionId,
  )
  const token = randomUUID()
  let acquired: string | null
  try {
    acquired = await redis.set(key, token, 'EX', LOCK_TTL_SEC, 'NX')
  } catch {
    throw new Error(
      'review_revision_conflict: concurrency control unavailable',
    )
  }
  if (acquired !== 'OK') {
    throw new Error(
      'review_revision_conflict: concurrent update in progress',
    )
  }
  try {
    return await input.run()
  } finally {
    try {
      await redis.eval(RELEASE_LOCK_LUA, 1, key, token)
    } catch {
      /* lock expires via TTL */
    }
  }
}

export async function claimLeadReviewRevision(input: {
  tenantWorkspaceId: string
  workspaceId: string
  sessionId: string
  nextRevision: number
}): Promise<'claimed' | 'conflict' | 'unavailable'> {
  const key = revisionClaimKey(
    input.tenantWorkspaceId,
    input.workspaceId,
    input.sessionId,
    input.nextRevision,
  )
  try {
    const result = await redis.set(
      key,
      '1',
      'EX',
      REVISION_CLAIM_TTL_SEC,
      'NX',
    )
    return result === 'OK' ? 'claimed' : 'conflict'
  } catch {
    return 'unavailable'
  }
}

export async function releaseLeadReviewRevisionClaim(input: {
  tenantWorkspaceId: string
  workspaceId: string
  sessionId: string
  nextRevision: number
}): Promise<void> {
  const key = revisionClaimKey(
    input.tenantWorkspaceId,
    input.workspaceId,
    input.sessionId,
    input.nextRevision,
  )
  try {
    await redis.del(key)
  } catch {
    /* best-effort rollback */
  }
}
