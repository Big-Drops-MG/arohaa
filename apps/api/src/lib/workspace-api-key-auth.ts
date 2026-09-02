import { and, eq, isNull } from 'drizzle-orm'
import {
  db,
  isWorkspaceApiKeyFormat,
  landingPages,
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

function keyHasScope(scopes: string[] | null | undefined, required: string): boolean {
  return (scopes ?? []).includes(required)
}

export async function verifyWorkspaceApiKeyForWorkspace(
  authorization: string | string[] | undefined,
  workspaceId: string,
  requiredScope?: string,
): Promise<boolean> {
  const token = parseBearerToken(authorization)
  if (!token || !isWorkspaceApiKeyFormat(token)) return false

  const rows = await db
    .select({
      id: workspaceApiKeys.id,
      keyHash: workspaceApiKeys.keyHash,
      scopes: workspaceApiKeys.scopes,
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
    if (requiredScope && !keyHasScope(row.scopes, requiredScope)) continue

    await db
      .update(workspaceApiKeys)
      .set({ lastUsedAt: new Date() })
      .where(eq(workspaceApiKeys.id, row.id))

    return true
  }

  return false
}

export async function verifyWorkspaceApiKeyForLandingPage(
  authorization: string | string[] | undefined,
  landingPageId: string,
  requiredScope: string,
): Promise<boolean> {
  const landingPage = await db.query.landingPages.findFirst({
    where: eq(landingPages.id, landingPageId),
    columns: { workspaceId: true },
  })
  if (!landingPage) return false

  return verifyWorkspaceApiKeyForWorkspace(
    authorization,
    landingPage.workspaceId,
    requiredScope,
  )
}
