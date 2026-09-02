import { NextResponse } from "next/server"
import {
  canAccessMemberLogs,
  loadTeamMemberLogsForApi,
} from "@/lib/server/team-member-logs"
import { route } from "@/lib/server/route"

export const GET = route(
  {
    permission: "landing_pages.read",
    actor: "read",
    tab: "workspace",
    rateLimit: "landing",
  },
  async ({ actor, params }) => {
    const userId = params.userId?.trim()
    if (!userId) {
      return NextResponse.json({ error: "Not found" }, { status: 404 })
    }

    if (!(await canAccessMemberLogs(actor, userId))) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const result = await loadTeamMemberLogsForApi(userId)
    if (!result.ok) {
      return NextResponse.json(
        { error: result.error },
        { status: result.status }
      )
    }

    return NextResponse.json(result.data)
  }
)
