import { lt } from 'drizzle-orm'
import { db, usedDelegationNonce } from '@workspace/database'

export async function consumeDelegationNonce(params: {
  nonce: string
  userId: string
  expiresAt: Date
}): Promise<boolean> {
  const inserted = await db
    .insert(usedDelegationNonce)
    .values({
      nonce: params.nonce,
      userId: params.userId,
      expiresAt: params.expiresAt,
    })
    .onConflictDoNothing()
    .returning({ nonce: usedDelegationNonce.nonce })

  void pruneExpiredDelegationNonces()

  return inserted.length > 0
}

async function pruneExpiredDelegationNonces(): Promise<void> {
  await db
    .delete(usedDelegationNonce)
    .where(lt(usedDelegationNonce.expiresAt, new Date()))
}
