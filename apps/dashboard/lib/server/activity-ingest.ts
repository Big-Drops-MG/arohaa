import "server-only"

import type {
  UserActivityEventType,
  UserActivityLogInput,
} from "@/lib/server/user-activity-log"

const ALLOWED_EVENT_TYPES = new Set<UserActivityEventType>([
  "page_view",
  "tab_view",
  "button_click",
  "nav_click",
  "action",
])

export const MAX_ACTIVITY_EVENTS_PER_REQUEST = 40

export type IncomingActivityEvent = {
  eventType?: string
  summary?: string
  path?: string
  tab?: string
  projectPublicId?: string
  targetLabel?: string
  targetHref?: string
  metadata?: Record<string, unknown>
}

export function sanitizeActivityEvent(
  raw: IncomingActivityEvent,
  actorUserId: string,
  ipAddress: string | null,
  userAgent: string | null
): UserActivityLogInput | null {
  const eventType = raw.eventType?.trim()
  if (
    !eventType ||
    !ALLOWED_EVENT_TYPES.has(eventType as UserActivityEventType)
  ) {
    return null
  }
  const summary = raw.summary?.trim()
  if (!summary) return null

  return {
    actorUserId,
    eventType,
    summary: summary.slice(0, 300),
    path: raw.path?.trim().slice(0, 500) || null,
    tab: raw.tab?.trim().slice(0, 80) || null,
    projectPublicId: raw.projectPublicId?.trim().slice(0, 80) || null,
    targetLabel: raw.targetLabel?.trim().slice(0, 200) || null,
    targetHref: raw.targetHref?.trim().slice(0, 500) || null,
    ipAddress,
    userAgent,
    metadata:
      raw.metadata && typeof raw.metadata === "object" ? raw.metadata : null,
  }
}
