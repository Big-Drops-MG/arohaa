import { and, eq, isNull } from 'drizzle-orm'
import {
  db,
  isWorkspaceApiKeyFormat,
  verifyWorkspaceApiKeyHash,
  workspaceApiKeys,
} from '@workspace/database'

function parseBearerToken(
  authorization: string | string[] | undefined,
): string | null {
  const raw = Array.isArray(authorization) ? authorization[0] : authorization
  if (!raw?.startsWith('Bearer ')) return null
  const token = raw.slice('Bearer '.length).trim()
  return token || null
}

export async function verifyWorkspaceApiKeyForWorkspace(
  authorization: string | string[] | undefined,
  workspaceId: string,
): Promise<boolean> {
  const token = parseBearerToken(authorization)
  if (!token || !isWorkspaceApiKeyFormat(token)) return false

  const rows = await db
    .select({
      id: workspaceApiKeys.id,
      keyHash: workspaceApiKeys.keyHash,
    })
    .from(workspaceApiKeys)
    .where(
      and(
        eq(workspaceApiKeys.workspaceId, workspaceId),
        isNull(workspaceApiKeys.revokedAt),
      ),
    )

  for (const row of rows) {
    if (!verifyWorkspaceApiKeyHash(token, row.keyHash)) continue

    await db
      .update(workspaceApiKeys)
      .set({ lastUsedAt: new Date() })
      .where(eq(workspaceApiKeys.id, row.id))

    return true
  }

  return false
}
