import { and, desc, eq, isNull } from "drizzle-orm"
import {
  db,
  detectWebhookProvider,
  isAllowedWebhookUrl,
  postWebhook,
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
  lastTestedAt: string | null
  lastTestStatus: string | null
  lastTestError: string | null
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

function toListItem(row: {
  id: string
  name: string
  url: string
  provider: string
  enabled: boolean
  lastTestedAt: Date | null
  lastTestStatus: string | null
  lastTestError: string | null
  createdAt: Date
}): WorkspaceWebhookListItem {
  return {
    id: row.id,
    name: row.name,
    url: maskWebhookUrl(row.url),
    provider: row.provider,
    enabled: row.enabled,
    lastTestedAt: row.lastTestedAt?.toISOString() ?? null,
    lastTestStatus: row.lastTestStatus,
    lastTestError: row.lastTestError,
    createdAt: row.createdAt.toISOString(),
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
      lastTestedAt: workspaceAlertWebhooks.lastTestedAt,
      lastTestStatus: workspaceAlertWebhooks.lastTestStatus,
      lastTestError: workspaceAlertWebhooks.lastTestError,
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

  return rows.map((row) => toListItem(row))
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
      lastTestedAt: workspaceAlertWebhooks.lastTestedAt,
      lastTestStatus: workspaceAlertWebhooks.lastTestStatus,
      lastTestError: workspaceAlertWebhooks.lastTestError,
      createdAt: workspaceAlertWebhooks.createdAt,
    })

  if (!row) return { error: "Failed to create webhook" }

  return {
    item: toListItem(row),
  }
}

export async function setWorkspaceAlertWebhookEnabled(
  ownerUserId: string,
  webhookId: string,
  enabled: boolean
): Promise<{ item: WorkspaceWebhookListItem } | { error: string }> {
  const workspace = await getOrCreateOwnerWorkspace(ownerUserId)
  const [row] = await db
    .update(workspaceAlertWebhooks)
    .set({ enabled })
    .where(
      and(
        eq(workspaceAlertWebhooks.id, webhookId),
        eq(workspaceAlertWebhooks.workspaceId, workspace.id),
        isNull(workspaceAlertWebhooks.deletedAt)
      )
    )
    .returning({
      id: workspaceAlertWebhooks.id,
      name: workspaceAlertWebhooks.name,
      url: workspaceAlertWebhooks.url,
      provider: workspaceAlertWebhooks.provider,
      enabled: workspaceAlertWebhooks.enabled,
      lastTestedAt: workspaceAlertWebhooks.lastTestedAt,
      lastTestStatus: workspaceAlertWebhooks.lastTestStatus,
      lastTestError: workspaceAlertWebhooks.lastTestError,
      createdAt: workspaceAlertWebhooks.createdAt,
    })

  if (!row) return { error: "Webhook not found" }
  return { item: toListItem(row) }
}

export async function testWorkspaceAlertWebhook(
  ownerUserId: string,
  webhookId: string
): Promise<
  | { item: WorkspaceWebhookListItem; success: true }
  | { item: WorkspaceWebhookListItem; success: false; error: string }
  | { error: string }
> {
  const workspace = await getOrCreateOwnerWorkspace(ownerUserId)
  const [existing] = await db
    .select({
      id: workspaceAlertWebhooks.id,
      name: workspaceAlertWebhooks.name,
      url: workspaceAlertWebhooks.url,
      provider: workspaceAlertWebhooks.provider,
      enabled: workspaceAlertWebhooks.enabled,
      lastTestedAt: workspaceAlertWebhooks.lastTestedAt,
      lastTestStatus: workspaceAlertWebhooks.lastTestStatus,
      lastTestError: workspaceAlertWebhooks.lastTestError,
      createdAt: workspaceAlertWebhooks.createdAt,
    })
    .from(workspaceAlertWebhooks)
    .where(
      and(
        eq(workspaceAlertWebhooks.id, webhookId),
        eq(workspaceAlertWebhooks.workspaceId, workspace.id),
        isNull(workspaceAlertWebhooks.deletedAt)
      )
    )
    .limit(1)

  if (!existing) return { error: "Webhook not found" }

  const testedAt = new Date()
  const testPayload: OutboundWebhookPayload = {
    title: "Arohaa webhook test",
    body: `Test delivery for "${existing.name}". Analytics alerts will use this channel.`,
    severity: "info",
    source: "dashboard.webhook.test",
  }

  try {
    await postWebhook(existing.url, testPayload)
    const [row] = await db
      .update(workspaceAlertWebhooks)
      .set({
        lastTestedAt: testedAt,
        lastTestStatus: "success",
        lastTestError: null,
      })
      .where(eq(workspaceAlertWebhooks.id, webhookId))
      .returning({
        id: workspaceAlertWebhooks.id,
        name: workspaceAlertWebhooks.name,
        url: workspaceAlertWebhooks.url,
        provider: workspaceAlertWebhooks.provider,
        enabled: workspaceAlertWebhooks.enabled,
        lastTestedAt: workspaceAlertWebhooks.lastTestedAt,
        lastTestStatus: workspaceAlertWebhooks.lastTestStatus,
        lastTestError: workspaceAlertWebhooks.lastTestError,
        createdAt: workspaceAlertWebhooks.createdAt,
      })

    if (!row) return { error: "Webhook not found" }
    return { item: toListItem(row), success: true }
  } catch (err) {
    const message = err instanceof Error ? err.message : "Webhook test failed"
    const [row] = await db
      .update(workspaceAlertWebhooks)
      .set({
        lastTestedAt: testedAt,
        lastTestStatus: "failed",
        lastTestError: message,
      })
      .where(eq(workspaceAlertWebhooks.id, webhookId))
      .returning({
        id: workspaceAlertWebhooks.id,
        name: workspaceAlertWebhooks.name,
        url: workspaceAlertWebhooks.url,
        provider: workspaceAlertWebhooks.provider,
        enabled: workspaceAlertWebhooks.enabled,
        lastTestedAt: workspaceAlertWebhooks.lastTestedAt,
        lastTestStatus: workspaceAlertWebhooks.lastTestStatus,
        lastTestError: workspaceAlertWebhooks.lastTestError,
        createdAt: workspaceAlertWebhooks.createdAt,
      })

    if (!row) return { error: message }
    return { item: toListItem(row), success: false, error: message }
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
