import type { LandingPageAuditLogEntry } from "@/features/settings/model/landing-page-audit-log"
import { formatSettingsTimestamp } from "@/features/settings/utils/settings-format"

const ACTION_LABELS: Record<string, string> = {
  create: "Project created",
  update: "Settings updated",
  delete: "Project deleted",
  archive: "Project archived",
  verify_html: "HTML verification",
  check_connection: "Connection checked",
  live_toggle: "Live status changed",
}

export function formatAuditLogAction(action: string): string {
  return ACTION_LABELS[action] ?? action.replaceAll("_", " ")
}

export function formatAuditLogActor(entry: LandingPageAuditLogEntry): string {
  const name = [entry.actorFirstName, entry.actorLastName]
    .filter(Boolean)
    .join(" ")
    .trim()

  if (name && entry.actorEmail) {
    return `${name} (${entry.actorEmail})`
  }

  return entry.actorEmail ?? entry.actorUserId
}

export function formatAuditLogTimestamp(iso: string): string {
  return formatSettingsTimestamp(iso)
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

  if (typeof payload.brandName === "string") {
    return `Brand: ${payload.brandName}`
  }

  if (typeof payload.status === "string") {
    return `Status: ${payload.status}`
  }

  const keys = Object.keys(payload)
  if (keys.length <= 3) {
    return keys.map((key) => `${key}: ${String(payload[key])}`).join(" · ")
  }

  return `${keys.length} fields changed`
}

export function formatAuditLogDetail(entry: LandingPageAuditLogEntry): string {
  const after = summarizePayload(entry.afterPayload)
  const before = summarizePayload(entry.beforePayload)

  if (after) return after
  if (before) return before
  return "—"
}

export function groupAuditLogsByDate(
  items: LandingPageAuditLogEntry[]
): { dateLabel: string; items: LandingPageAuditLogEntry[] }[] {
  const groups = new Map<string, LandingPageAuditLogEntry[]>()

  for (const item of items) {
    const date = new Date(item.createdAt)
    const dateLabel = Number.isNaN(date.getTime())
      ? "Unknown date"
      : date.toLocaleDateString(undefined, {
          weekday: "long",
          month: "short",
          day: "numeric",
          year: "numeric",
        })

    const bucket = groups.get(dateLabel) ?? []
    bucket.push(item)
    groups.set(dateLabel, bucket)
  }

  return Array.from(groups.entries()).map(([dateLabel, groupItems]) => ({
    dateLabel,
    items: groupItems,
  }))
}
