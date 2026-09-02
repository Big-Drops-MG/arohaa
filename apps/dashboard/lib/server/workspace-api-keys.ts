import { and, desc, eq, isNull } from "drizzle-orm"
import {
  db,
  generateWorkspaceApiKey,
  WORKSPACE_API_KEY_SCOPE_ANALYTICS,
  workspaceApiKeys,
  type WorkspaceApiKeyScope,
} from "@workspace/database"
import { getOrCreateOwnerWorkspace } from "@/lib/server/resolve-workspace"
import type { Actor } from "@/lib/server/actor-can"
import { validateRequestedApiKeyScopes } from "@/lib/server/workspace-api-key-scopes"

const MAX_KEYS_PER_WORKSPACE = 10

export type WorkspaceApiKeyListItem = {
  id: string
  name: string
  keyPrefix: string
  scopes: WorkspaceApiKeyScope[]
  createdAt: string
  lastUsedAt: string | null
}

export async function listWorkspaceApiKeys(
  ownerUserId: string
): Promise<WorkspaceApiKeyListItem[]> {
  const workspace = await getOrCreateOwnerWorkspace(ownerUserId)
  const rows = await db
    .select({
      id: workspaceApiKeys.id,
      name: workspaceApiKeys.name,
      keyPrefix: workspaceApiKeys.keyPrefix,
      scopes: workspaceApiKeys.scopes,
      createdAt: workspaceApiKeys.createdAt,
      lastUsedAt: workspaceApiKeys.lastUsedAt,
    })
    .from(workspaceApiKeys)
    .where(
      and(
        eq(workspaceApiKeys.workspaceId, workspace.id),
        isNull(workspaceApiKeys.revokedAt)
      )
    )
    .orderBy(desc(workspaceApiKeys.createdAt))

  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    keyPrefix: row.keyPrefix,
    scopes: row.scopes as WorkspaceApiKeyScope[],
    createdAt: row.createdAt.toISOString(),
    lastUsedAt: row.lastUsedAt?.toISOString() ?? null,
  }))
}

export async function createWorkspaceApiKey(
  actor: Actor,
  ownerUserId: string,
  input: { name: string; scopes?: string[] }
): Promise<{ item: WorkspaceApiKeyListItem; key: string } | { error: string }> {
  const trimmed = input.name.trim()
  if (!trimmed) return { error: "Key name is required" }
  if (trimmed.length > 80) return { error: "Key name is too long" }

  const scopeCheck = await validateRequestedApiKeyScopes(
    actor,
    input.scopes?.length ? input.scopes : [WORKSPACE_API_KEY_SCOPE_ANALYTICS]
  )
  if ("error" in scopeCheck) return { error: scopeCheck.error }

  const workspace = await getOrCreateOwnerWorkspace(ownerUserId)
  const existing = await listWorkspaceApiKeys(ownerUserId)
  if (existing.length >= MAX_KEYS_PER_WORKSPACE) {
    return { error: `Maximum of ${MAX_KEYS_PER_WORKSPACE} active keys allowed` }
  }

  const generated = generateWorkspaceApiKey()
  const [row] = await db
    .insert(workspaceApiKeys)
    .values({
      workspaceId: workspace.id,
      name: trimmed,
      keyPrefix: generated.prefix,
      keyHash: generated.hash,
      scopes: scopeCheck.scopes,
      createdByUserId: ownerUserId,
    })
    .returning({
      id: workspaceApiKeys.id,
      name: workspaceApiKeys.name,
      keyPrefix: workspaceApiKeys.keyPrefix,
      scopes: workspaceApiKeys.scopes,
      createdAt: workspaceApiKeys.createdAt,
      lastUsedAt: workspaceApiKeys.lastUsedAt,
    })

  if (!row) return { error: "Failed to create API key" }

  return {
    key: generated.key,
    item: {
      id: row.id,
      name: row.name,
      keyPrefix: row.keyPrefix,
      scopes: row.scopes as WorkspaceApiKeyScope[],
      createdAt: row.createdAt.toISOString(),
      lastUsedAt: row.lastUsedAt?.toISOString() ?? null,
    },
  }
}

export async function revokeWorkspaceApiKey(
  ownerUserId: string,
  keyId: string
): Promise<{ ok: true } | { error: string }> {
  const workspace = await getOrCreateOwnerWorkspace(ownerUserId)
  const [row] = await db
    .select({ id: workspaceApiKeys.id })
    .from(workspaceApiKeys)
    .where(
      and(
        eq(workspaceApiKeys.id, keyId),
        eq(workspaceApiKeys.workspaceId, workspace.id),
        isNull(workspaceApiKeys.revokedAt)
      )
    )
    .limit(1)

  if (!row) return { error: "API key not found" }

  await db
    .update(workspaceApiKeys)
    .set({ revokedAt: new Date() })
    .where(eq(workspaceApiKeys.id, keyId))

  return { ok: true }
}
