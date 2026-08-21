import "server-only"

import { desc, eq } from "drizzle-orm"
import { db, userActivityLogs } from "@workspace/database"

export type UserActivityEventType =
  | "page_view"
  | "tab_view"
  | "button_click"
  | "nav_click"
  | "action"

export type UserActivityLogInput = {
  actorUserId: string
  eventType: UserActivityEventType | string
  summary: string
  path?: string | null
  tab?: string | null
  projectPublicId?: string | null
  targetLabel?: string | null
  targetHref?: string | null
  ipAddress?: string | null
  userAgent?: string | null
  metadata?: Record<string, unknown> | null
}

export type UserActivityLogRow = {
  id: string
  source: "activity"
  eventType: string
  summary: string
  path: string | null
  tab: string | null
  projectPublicId: string | null
  targetLabel: string | null
  targetHref: string | null
  ipAddress: string | null
  userAgent: string | null
  metadata: Record<string, unknown> | null
  createdAt: string
  actorUserId: string
}

function trimOrNull(
  value: string | null | undefined,
  max = 500
): string | null {
  if (!value) return null
  const trimmed = value.trim()
  if (!trimmed) return null
  return trimmed.length > max ? trimmed.slice(0, max) : trimmed
}

export async function writeUserActivityLog(
  input: UserActivityLogInput
): Promise<string> {
  const id = crypto.randomUUID()
  await db.insert(userActivityLogs).values({
    id,
    actorUserId: input.actorUserId,
    eventType: input.eventType.trim() || "action",
    summary: trimOrNull(input.summary, 300) || "Activity",
    path: trimOrNull(input.path, 500),
    tab: trimOrNull(input.tab, 80),
    projectPublicId: trimOrNull(input.projectPublicId, 80),
    targetLabel: trimOrNull(input.targetLabel, 200),
    targetHref: trimOrNull(input.targetHref, 500),
    ipAddress: trimOrNull(input.ipAddress, 80),
    userAgent: trimOrNull(input.userAgent, 500),
    metadata: input.metadata ?? null,
  })
  return id
}

export async function writeUserActivityLogs(
  inputs: UserActivityLogInput[]
): Promise<number> {
  if (inputs.length === 0) return 0
  const rows = inputs.map((input) => ({
    id: crypto.randomUUID(),
    actorUserId: input.actorUserId,
    eventType: input.eventType.trim() || "action",
    summary: trimOrNull(input.summary, 300) || "Activity",
    path: trimOrNull(input.path, 500),
    tab: trimOrNull(input.tab, 80),
    projectPublicId: trimOrNull(input.projectPublicId, 80),
    targetLabel: trimOrNull(input.targetLabel, 200),
    targetHref: trimOrNull(input.targetHref, 500),
    ipAddress: trimOrNull(input.ipAddress, 80),
    userAgent: trimOrNull(input.userAgent, 500),
    metadata: input.metadata ?? null,
  }))
  await db.insert(userActivityLogs).values(rows)
  return rows.length
}

export async function listUserActivityLogsByActor(
  actorUserId: string,
  limit = 200
): Promise<UserActivityLogRow[]> {
  const rows = await db
    .select({
      id: userActivityLogs.id,
      eventType: userActivityLogs.eventType,
      summary: userActivityLogs.summary,
      path: userActivityLogs.path,
      tab: userActivityLogs.tab,
      projectPublicId: userActivityLogs.projectPublicId,
      targetLabel: userActivityLogs.targetLabel,
      targetHref: userActivityLogs.targetHref,
      ipAddress: userActivityLogs.ipAddress,
      userAgent: userActivityLogs.userAgent,
      metadata: userActivityLogs.metadata,
      createdAt: userActivityLogs.createdAt,
      actorUserId: userActivityLogs.actorUserId,
    })
    .from(userActivityLogs)
    .where(eq(userActivityLogs.actorUserId, actorUserId))
    .orderBy(desc(userActivityLogs.createdAt))
    .limit(limit)

  return rows.map((row) => ({
    id: row.id,
    source: "activity" as const,
    eventType: row.eventType,
    summary: row.summary,
    path: row.path,
    tab: row.tab,
    projectPublicId: row.projectPublicId,
    targetLabel: row.targetLabel,
    targetHref: row.targetHref,
    ipAddress: row.ipAddress,
    userAgent: row.userAgent,
    metadata: row.metadata,
    createdAt: row.createdAt.toISOString(),
    actorUserId: row.actorUserId,
  }))
}
