import { and, desc, eq, isNull } from "drizzle-orm"
import {
  db,
  detectWebhookProvider,
  isAllowedWebhookUrl,
  postWebhookToMany,
  workspaceAlertWebhooks,
  type OutboundWebhookPayload,
} from "@workspace/database"
import { getOrCreateOwnerWorkspace } from "@/lib/server/resolve-workspace"

const MAX_WEBHOOKS_PER_WORKSPACE = 5

export type WorkspaceWebhookListItem = {
  id: string
  name: string
  url: string
  provider: string
  enabled: boolean
  createdAt: string
}

function maskWebhookUrl(url: string): string {
  try {
    const parsed = new URL(url)
    const parts = parsed.pathname.split("/").filter(Boolean)
    if (parts.length >= 2) {
      const tail = parts[parts.length - 1] ?? ""
      return `${parsed.origin}/…/${tail.slice(0, 4)}…`
    }
    return `${parsed.origin}/…`
  } catch {
    return "…"
  }
}

export async function listWorkspaceAlertWebhooks(
  ownerUserId: string
): Promise<WorkspaceWebhookListItem[]> {
  const workspace = await getOrCreateOwnerWorkspace(ownerUserId)
  const rows = await db
    .select({
      id: workspaceAlertWebhooks.id,
      name: workspaceAlertWebhooks.name,
      url: workspaceAlertWebhooks.url,
      provider: workspaceAlertWebhooks.provider,
      enabled: workspaceAlertWebhooks.enabled,
      createdAt: workspaceAlertWebhooks.createdAt,
    })
    .from(workspaceAlertWebhooks)
    .where(
      and(
        eq(workspaceAlertWebhooks.workspaceId, workspace.id),
        isNull(workspaceAlertWebhooks.deletedAt)
      )
    )
    .orderBy(desc(workspaceAlertWebhooks.createdAt))

  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    url: maskWebhookUrl(row.url),
    provider: row.provider,
    enabled: row.enabled,
    createdAt: row.createdAt.toISOString(),
  }))
}

export async function createWorkspaceAlertWebhook(
  ownerUserId: string,
  input: { name: string; url: string }
): Promise<{ item: WorkspaceWebhookListItem } | { error: string }> {
  const name = input.name.trim()
  const url = input.url.trim()
  if (!name) return { error: "Webhook name is required" }
  if (name.length > 80) return { error: "Webhook name is too long" }
  if (!isAllowedWebhookUrl(url)) {
    return {
      error:
        "Webhook URL must be a valid HTTPS Slack or Discord incoming webhook",
    }
  }

  const workspace = await getOrCreateOwnerWorkspace(ownerUserId)
  const existing = await listWorkspaceAlertWebhooks(ownerUserId)
  if (existing.length >= MAX_WEBHOOKS_PER_WORKSPACE) {
    return {
      error: `Maximum of ${MAX_WEBHOOKS_PER_WORKSPACE} webhooks allowed`,
    }
  }

  const provider = detectWebhookProvider(url)
  const [row] = await db
    .insert(workspaceAlertWebhooks)
    .values({
      workspaceId: workspace.id,
      name,
      url,
      provider,
      enabled: true,
    })
    .returning({
      id: workspaceAlertWebhooks.id,
      name: workspaceAlertWebhooks.name,
      url: workspaceAlertWebhooks.url,
      provider: workspaceAlertWebhooks.provider,
      enabled: workspaceAlertWebhooks.enabled,
      createdAt: workspaceAlertWebhooks.createdAt,
    })

  if (!row) return { error: "Failed to create webhook" }

  return {
    item: {
      id: row.id,
      name: row.name,
      url: maskWebhookUrl(row.url),
      provider: row.provider,
      enabled: row.enabled,
      createdAt: row.createdAt.toISOString(),
    },
  }
}

export async function deleteWorkspaceAlertWebhook(
  ownerUserId: string,
  webhookId: string
): Promise<{ ok: true } | { error: string }> {
  const workspace = await getOrCreateOwnerWorkspace(ownerUserId)
  const [row] = await db
    .select({ id: workspaceAlertWebhooks.id })
    .from(workspaceAlertWebhooks)
    .where(
      and(
        eq(workspaceAlertWebhooks.id, webhookId),
        eq(workspaceAlertWebhooks.workspaceId, workspace.id),
        isNull(workspaceAlertWebhooks.deletedAt)
      )
    )
    .limit(1)

  if (!row) return { error: "Webhook not found" }

  await db
    .update(workspaceAlertWebhooks)
    .set({ deletedAt: new Date(), enabled: false })
    .where(eq(workspaceAlertWebhooks.id, webhookId))

  return { ok: true }
}

export async function dispatchWorkspaceAlertWebhooks(
  workspaceId: string,
  payload: OutboundWebhookPayload
): Promise<void> {
  const rows = await db
    .select({ url: workspaceAlertWebhooks.url })
    .from(workspaceAlertWebhooks)
    .where(
      and(
        eq(workspaceAlertWebhooks.workspaceId, workspaceId),
        eq(workspaceAlertWebhooks.enabled, true),
        isNull(workspaceAlertWebhooks.deletedAt)
      )
    )

  const urls = rows.map((row) => row.url)
  await postWebhookToMany(urls, payload)
}
