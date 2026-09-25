import { NextResponse } from "next/server"
import { loadInteractionLogForApi } from "@/lib/server/interaction-log-load"
import { route } from "@/lib/server/route"

export const GET = route(
  {
    permission: "landing_pages.read",
    actor: "read",
    tab: "data-lab",
    section: "leads",
    rateLimit: "landing",
  },
  async ({ params, request }) => {
    const { searchParams } = new URL(request.url)
    const sessionId = searchParams.get("session_id") ?? ""
    const res = await loadInteractionLogForApi(params.publicId!, sessionId)

    if (!res.ok) {
      return NextResponse.json({ error: res.error }, { status: res.status })
    }

    return NextResponse.json(res.data)
  }
)
