import { PROJECT_TABS } from "@/features/dashboard/model/project-tab"
import { formatDashboardDateLong } from "@/lib/datetime"
import { formatSettingsTimestamp } from "@/features/settings/utils/settings-format"

export type TeamActivityLogEntry = {
  id: string
  source: "activity" | "audit"
  eventType: string
  summary: string
  detail: string | null
  path: string | null
  tab: string | null
  projectPublicId: string | null
  projectName: string | null
  targetLabel: string | null
  targetHref: string | null
  ipAddress: string | null
  userAgent: string | null
  createdAt: string
}

const EVENT_TYPE_LABELS: Record<string, string> = {
  page_view: "Page viewed",
  tab_view: "Tab opened",
  button_click: "Button clicked",
  nav_click: "Navigation",
  action: "Action",
  create: "Project created",
  update: "Settings updated",
  delete: "Project deleted",
  archive: "Project archived",
  verify_html: "HTML verification",
  check_connection: "Connection checked",
  live_toggle: "Live status changed",
  variant_link: "Linked as experiment variant",
  variant_unlink: "Removed from experiment",
}

const TAB_LABELS = Object.fromEntries(
  PROJECT_TABS.map((tab) => [tab.value, tab.label])
) as Record<string, string>

export function formatActivityEventType(eventType: string): string {
  return EVENT_TYPE_LABELS[eventType] ?? eventType.replaceAll("_", " ")
}

export function formatActivityTabLabel(
  tab: string | null | undefined
): string | null {
  if (!tab) return null
  return TAB_LABELS[tab] ?? tab
}

export function formatActivityTimestamp(iso: string): string {
  return formatSettingsTimestamp(iso)
}

export function shortenUserAgent(ua: string | null | undefined): string | null {
  if (!ua) return null
  if (ua.includes("Edg/")) return "Microsoft Edge"
  if (ua.includes("Chrome/") && !ua.includes("Edg/")) return "Chrome"
  if (ua.includes("Firefox/")) return "Firefox"
  if (ua.includes("Safari/") && !ua.includes("Chrome/")) return "Safari"
  return ua.length > 48 ? `${ua.slice(0, 45)}…` : ua
}

export function groupActivityLogsByDate(
  items: TeamActivityLogEntry[]
): { dateLabel: string; items: TeamActivityLogEntry[] }[] {
  const groups = new Map<string, TeamActivityLogEntry[]>()

  for (const item of items) {
    const date = new Date(item.createdAt)
    const dateLabel = Number.isNaN(date.getTime())
      ? "Unknown date"
      : formatDashboardDateLong(date)
    const bucket = groups.get(dateLabel) ?? []
    bucket.push(item)
    groups.set(dateLabel, bucket)
  }

  return Array.from(groups.entries()).map(([dateLabel, groupItems]) => ({
    dateLabel,
    items: groupItems,
  }))
}
