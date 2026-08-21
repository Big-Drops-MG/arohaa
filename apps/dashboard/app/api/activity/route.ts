import type { NextRequest } from "next/server"
import { NextResponse } from "next/server"
import { requireLandingPageActor } from "@/lib/server/landing-auth"
import { enforceLandingApiRateLimit } from "@/lib/server/rate-limit-landing"
import {
  clientIpFromRequest,
  userAgentFromRequest,
} from "@/lib/server/request-client-meta"
import {
  writeUserActivityLogs,
  type UserActivityEventType,
  type UserActivityLogInput,
} from "@/lib/server/user-activity-log"

const ALLOWED_EVENT_TYPES = new Set<UserActivityEventType>([
  "page_view",
  "tab_view",
  "button_click",
  "nav_click",
  "action",
])

const MAX_EVENTS_PER_REQUEST = 40

type IncomingActivityEvent = {
  eventType?: string
  summary?: string
  path?: string
  tab?: string
  projectPublicId?: string
  targetLabel?: string
  targetHref?: string
  metadata?: Record<string, unknown>
}

function sanitizeEvent(
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

export async function POST(request: NextRequest) {
  const actor = await requireLandingPageActor()
  if (!actor) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }
  const limited = await enforceLandingApiRateLimit(actor.id)
  if (limited) return limited

  let body: { events?: IncomingActivityEvent[] }
  try {
    body = (await request.json()) as { events?: IncomingActivityEvent[] }
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 })
  }

  if (!Array.isArray(body.events) || body.events.length === 0) {
    return NextResponse.json({ error: "events required" }, { status: 400 })
  }

  const ipAddress = clientIpFromRequest(request)
  const userAgent = userAgentFromRequest(request)

  const inputs = body.events
    .slice(0, MAX_EVENTS_PER_REQUEST)
    .map((event) => sanitizeEvent(event, actor.id, ipAddress, userAgent))
    .filter((event): event is UserActivityLogInput => event !== null)

  if (inputs.length === 0) {
    return NextResponse.json({ error: "No valid events" }, { status: 400 })
  }

  const written = await writeUserActivityLogs(inputs)
  return NextResponse.json({ ok: true, written })
}
