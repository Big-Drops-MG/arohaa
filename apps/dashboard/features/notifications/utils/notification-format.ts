import type { NotificationRecord } from "@/features/notifications/model/notifications"
import { formatSettingsTimestamp } from "@/features/settings/utils/settings-format"

export function formatNotificationTimestamp(iso: string): string {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) {
    return formatSettingsTimestamp(iso)
  }

  const now = Date.now()
  const diffMs = now - date.getTime()

  if (diffMs < 60_000) return "Just now"
  if (diffMs < 3_600_000) {
    const mins = Math.floor(diffMs / 60_000)
    return `${mins}m ago`
  }
  if (diffMs < 86_400_000) {
    const hours = Math.floor(diffMs / 3_600_000)
    return `${hours}h ago`
  }
  if (diffMs < 86_400_000 * 7) {
    const days = Math.floor(diffMs / 86_400_000)
    return `${days}d ago`
  }

  return formatSettingsTimestamp(iso)
}

export function notificationAccentClass(
  severity: NotificationRecord["severity"],
  type?: string
): string {
  if (type === "access_request") return "bg-violet-500"
  if (type === "connection") return "bg-emerald-500"
  if (type === "project_action") {
    if (severity === "error") return "bg-red-500"
    if (severity === "warning") return "bg-amber-500"
    return "bg-neutral-400"
  }

  switch (severity) {
    case "warning":
      return "bg-amber-500"
    case "error":
      return "bg-red-500"
    case "info":
      return "bg-sky-500"
    default:
      return "bg-neutral-400"
  }
}

export function isAccessRequestNotification(type: string): boolean {
  return type === "access_request"
}

/** @deprecated Prefer notificationAccentClass for the redesigned inbox. */
export function notificationRowClassName(
  severity: NotificationRecord["severity"],
  type?: string
): string {
  if (type === "access_request") {
    return "border-violet-200/80 bg-violet-50/50"
  }

  switch (severity) {
    case "warning":
      return "border-orange-200/80 bg-orange-50/50"
    case "error":
      return "border-red-200/80 bg-red-50/50"
    case "info":
      return "border-sky-200/80 bg-sky-50/50"
    default:
      return "border-border bg-background"
  }
}
