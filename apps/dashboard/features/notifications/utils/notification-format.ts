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

  return formatSettingsTimestamp(iso)
}

export function notificationRowClassName(
  severity: NotificationRecord["severity"]
): string {
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
