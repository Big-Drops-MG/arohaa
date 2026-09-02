import { NextResponse } from "next/server"
import {
  MAX_ACTIVITY_EVENTS_PER_REQUEST,
  sanitizeActivityEvent,
} from "@/lib/server/activity-ingest"
import { route } from "@/lib/server/route"
import { activityIngestBodySchema } from "@/lib/server/route-schemas"
import {
  clientIpFromRequest,
  userAgentFromRequest,
} from "@/lib/server/request-client-meta"
import { writeUserActivityLogs } from "@/lib/server/user-activity-log"

export const POST = route(
  {
    permission: "landing_pages.read",
    actor: "write",
    tab: "collection",
    rateLimit: "landing",
    schema: activityIngestBodySchema,
  },
  async ({ actor, body, request }) => {
    const ipAddress = clientIpFromRequest(request)
    const userAgent = userAgentFromRequest(request)

    const inputs = body.events
      .slice(0, MAX_ACTIVITY_EVENTS_PER_REQUEST)
      .map((event) =>
        sanitizeActivityEvent(event, actor.id, ipAddress, userAgent)
      )
      .filter((event): event is NonNullable<typeof event> => event !== null)

    if (inputs.length === 0) {
      return NextResponse.json({ error: "No valid events" }, { status: 400 })
    }

    const written = await writeUserActivityLogs(inputs)
    return NextResponse.json({ ok: true, written })
  }
)
