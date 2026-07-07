import { and, desc, eq, isNull } from "drizzle-orm"
import {
  db,
  generateWorkspaceApiKey,
  workspaceApiKeys,
} from "@workspace/database"
import { getOrCreateOwnerWorkspace } from "@/lib/server/resolve-workspace"

const MAX_KEYS_PER_WORKSPACE = 10

export type WorkspaceApiKeyListItem = {
  id: string
  name: string
  keyPrefix: string
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
    createdAt: row.createdAt.toISOString(),
    lastUsedAt: row.lastUsedAt?.toISOString() ?? null,
  }))
}

export async function createWorkspaceApiKey(
  ownerUserId: string,
  name: string
): Promise<{ item: WorkspaceApiKeyListItem; key: string } | { error: string }> {
  const trimmed = name.trim()
  if (!trimmed) return { error: "Key name is required" }
  if (trimmed.length > 80) return { error: "Key name is too long" }

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
      createdByUserId: ownerUserId,
    })
    .returning({
      id: workspaceApiKeys.id,
      name: workspaceApiKeys.name,
      keyPrefix: workspaceApiKeys.keyPrefix,
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
