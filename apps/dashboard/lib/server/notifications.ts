import { and, desc, eq, isNull, sql } from "drizzle-orm"
import {
  createNotification,
  db,
  landingPages,
  notifications,
  workspaces,
} from "@workspace/database"
import type { NotificationRecord } from "@/features/notifications/model/notifications"
import { fetchAlertsAnalytics } from "@/lib/server/alerts-dashboard-load"
import { dispatchWorkspaceAlertWebhooks } from "@/lib/server/workspace-alert-webhooks"

const SKIP_AUDIT_ACTIONS = new Set([
  "check_connection",
  // Routine settings saves are noisy; keep lifecycle / connection / experiment events.
  "update",
])

const MEANINGFUL_ALERT_KINDS = new Set([
  "traffic_drop",
  "fsr_drop",
  "form_starts_drop",
  "weekly_traffic_hike",
  "monthly_form_hike",
  "traffic_spike_from_low",
])

const ALERT_KIND_TITLES: Record<string, string> = {
  traffic_drop: "Traffic drop",
  traffic_spike: "Traffic spike",
  traffic_spike_from_low: "Traffic spike",
  weekly_traffic_hike: "Weekly traffic high",
  monthly_form_hike: "Monthly submissions high",
  fsr_drop: "Conversion drop",
  form_starts_drop: "Form starts drop",
}

function alertDayKey(date = new Date()): string {
  return date.toISOString().slice(0, 10)
}

function resolveAlertKind(alert: {
  id: string
  kind?: string
  severity: "warning" | "info"
  message: string
}): string | null {
  if (alert.kind) return alert.kind
  // Legacy payloads without kind: only promote warnings, keyed by id.
  if (alert.severity === "warning") return `legacy_${alert.id}`
  return null
}

function isMeaningfulInboxAlert(alert: {
  kind?: string
  severity: "warning" | "info"
}): boolean {
  if (alert.severity === "warning") return true
  if (alert.kind && MEANINGFUL_ALERT_KINDS.has(alert.kind)) return true
  return false
}

const AUDIT_ACTION_TITLES: Record<string, string> = {
  create: "Project created",
  update: "Settings updated",
  delete: "Project deleted",
  archive: "Project archived",
  verify_html: "HTML verification succeeded",
  live_toggle: "Live status changed",
  variant_link: "Linked as experiment variant",
  variant_unlink: "Removed from experiment",
}

function summarizePayload(
  payload: Record<string, unknown> | null
): string | null {
  if (!payload || Object.keys(payload).length === 0) return null

  if (typeof payload.connected === "boolean") {
    return payload.connected ? "Connected" : "Not connected"
  }

  if (typeof payload.isLive === "boolean") {
    return payload.isLive ? "Marked as live" : "Marked as not live"
  }

  if (typeof payload.variantLabel === "string") {
    const parent =
      typeof payload.variantOfBrandName === "string"
        ? ` of ${payload.variantOfBrandName}`
        : ""
    return `now Variant ${payload.variantLabel}${parent}`
  }

  if (typeof payload.experimentName === "string") {
    return `left "${payload.experimentName}"`
  }

  if (typeof payload.brandName === "string") {
    return payload.brandName
  }

  if (typeof payload.status === "string") {
    return `Status: ${payload.status}`
  }

  return null
}

function auditSeverity(action: string): string {
  if (action === "delete" || action === "archive") return "error"
  if (action === "live_toggle") return "warning"
  if (
    action === "verify_html" ||
    action === "create" ||
    action === "variant_link" ||
    action === "variant_unlink"
  ) {
    return "info"
  }
  return "alert"
}

function auditHref(slug: string, action: string): string {
  if (action === "delete" || action === "archive") {
    return "/dashboard"
  }
  if (
    action === "verify_html" ||
    action === "check_connection" ||
    action === "create"
  ) {
    return `/dashboard/${encodeURIComponent(slug)}?tab=settings&section=tracking`
  }
  if (action === "live_toggle") {
    return `/dashboard/${encodeURIComponent(slug)}?tab=settings&section=publishing`
  }
  if (action === "variant_link" || action === "variant_unlink") {
    return `/dashboard/${encodeURIComponent(slug)}?tab=settings&section=experiment`
  }
  return `/dashboard/${encodeURIComponent(slug)}?tab=settings&section=activity`
}

export async function resolveNotificationUserIdForLandingPage(
  landingPageId: string
): Promise<string | null> {
  const [row] = await db
    .select({ ownerUserId: workspaces.ownerUserId })
    .from(landingPages)
    .innerJoin(workspaces, eq(landingPages.workspaceId, workspaces.id))
    .where(eq(landingPages.id, landingPageId))
    .limit(1)

  return row?.ownerUserId ?? null
}

export async function enqueueNotificationFromAuditLog(input: {
  auditLogId: string
  actorUserId: string
  landingPageId: string
  action: string
  beforePayload?: Record<string, unknown> | null
  afterPayload?: Record<string, unknown> | null
}): Promise<void> {
  if (SKIP_AUDIT_ACTIONS.has(input.action)) {
    return
  }

  const [landingPage] = await db
    .select({
      publicId: landingPages.publicId,
      slug: landingPages.slug,
      brandName: landingPages.brandName,
    })
    .from(landingPages)
    .where(eq(landingPages.id, input.landingPageId))
    .limit(1)

  if (!landingPage) return

  const userId =
    (await resolveNotificationUserIdForLandingPage(input.landingPageId)) ??
    input.actorUserId

  const title =
    AUDIT_ACTION_TITLES[input.action] ?? input.action.replaceAll("_", " ")

  const detail =
    summarizePayload(input.afterPayload ?? null) ??
    summarizePayload(input.beforePayload ?? null)

  const body = detail
    ? `${landingPage.brandName}: ${detail}`
    : landingPage.brandName

  await createNotification({
    userId,
    type: "project_action",
    title,
    body,
    severity: auditSeverity(input.action),
    landingPageId: input.landingPageId,
    landingPagePublicId: landingPage.publicId,
    href: auditHref(landingPage.slug, input.action),
    sourceType: "audit_log",
    sourceId: input.auditLogId,
  })
}

export async function enqueueSdkConnectedNotification(input: {
  landingPageId: string
  publicId: string
  slug: string
  brandName: string
  ownerUserId: string
}): Promise<void> {
  await createNotification({
    userId: input.ownerUserId,
    type: "connection",
    title: "SDK connected",
    body: `${input.brandName} is now sending events.`,
    severity: "info",
    landingPageId: input.landingPageId,
    landingPagePublicId: input.publicId,
    href: `/dashboard/${encodeURIComponent(input.slug)}?tab=settings&section=tracking`,
    sourceType: "sdk_connected",
    sourceId: input.landingPageId,
  })
}

function toNotificationRecord(row: {
  id: string
  type: string
  title: string
  body: string
  severity: string
  landingPageId: string | null
  landingPagePublicId: string | null
  href: string | null
  readAt: Date | null
  createdAt: Date
}): NotificationRecord {
  return {
    id: row.id,
    type: row.type,
    title: row.title,
    body: row.body,
    severity: row.severity as NotificationRecord["severity"],
    landingPageId: row.landingPageId,
    landingPagePublicId: row.landingPagePublicId,
    href: row.href,
    readAt: row.readAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
  }
}

export async function listUserNotifications(
  userId: string,
  limit = 30
): Promise<NotificationRecord[]> {
  const rows = await db
    .select()
    .from(notifications)
    .where(eq(notifications.userId, userId))
    .orderBy(desc(notifications.createdAt))
    .limit(limit)

  return rows.map(toNotificationRecord)
}

export async function countUnreadNotifications(
  userId: string
): Promise<number> {
  const [row] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(notifications)
    .where(and(eq(notifications.userId, userId), isNull(notifications.readAt)))

  return row?.count ?? 0
}

export async function markNotificationRead(
  userId: string,
  notificationId: string
): Promise<boolean> {
  const now = new Date()
  const updated = await db
    .update(notifications)
    .set({ readAt: now })
    .where(
      and(
        eq(notifications.id, notificationId),
        eq(notifications.userId, userId),
        isNull(notifications.readAt)
      )
    )
    .returning({ id: notifications.id })

  return updated.length > 0
}

export async function markAllNotificationsRead(
  userId: string
): Promise<number> {
  const now = new Date()
  const updated = await db
    .update(notifications)
    .set({ readAt: now })
    .where(and(eq(notifications.userId, userId), isNull(notifications.readAt)))
    .returning({ id: notifications.id })

  return updated.length
}

function mapAlertSeverity(severity: "warning" | "info"): string {
  return severity === "info" ? "info" : "warning"
}

export async function syncAnalyticsAlertNotifications(
  userId: string
): Promise<void> {
  const pages = await db
    .select({
      id: landingPages.id,
      publicId: landingPages.publicId,
      slug: landingPages.slug,
      brandName: landingPages.brandName,
      workspaceId: landingPages.workspaceId,
    })
    .from(landingPages)
    .innerJoin(workspaces, eq(landingPages.workspaceId, workspaces.id))
    .where(
      and(eq(workspaces.ownerUserId, userId), isNull(landingPages.deletedAt))
    )

  const dayKey = alertDayKey()

  await Promise.all(
    pages.map(async (page) => {
      const analytics = await fetchAlertsAnalytics(
        page.workspaceId,
        page.publicId,
        "7d"
      )
      if (!analytics?.items.length) return

      for (const alert of analytics.items) {
        if (!isMeaningfulInboxAlert(alert)) continue

        const kind = resolveAlertKind(alert)
        if (!kind) continue

        const title = ALERT_KIND_TITLES[kind] ?? "Analytics alert"
        const body = `${page.brandName}: ${alert.message}`
        const result = await createNotification({
          userId,
          type: "analytics_alert",
          title,
          body,
          severity: mapAlertSeverity(alert.severity),
          landingPageId: page.id,
          landingPagePublicId: page.publicId,
          href: `/dashboard/${encodeURIComponent(page.slug)}?tab=alerts`,
          sourceType: "analytics_alert",
          // One inbox item per page + alert kind per calendar day (stable; no % in key).
          sourceId: `${page.publicId}:${kind}:${dayKey}`,
        })

        if (result?.created) {
          void dispatchWorkspaceAlertWebhooks(page.workspaceId, {
            title,
            body,
            severity: alert.severity === "info" ? "info" : "warning",
            source: `analytics:${page.publicId}:${kind}`,
          }).catch(() => undefined)
        }
      }
    })
  )
}
