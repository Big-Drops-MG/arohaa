import { NextResponse } from "next/server"
import { route } from "@/lib/server/route"
import { sendCampaignNow } from "@/lib/server/web-push-dashboard"

export const POST = route(
  {
    permission: "landing_pages.write",
    actor: "write",
    tab: "notification-center",
    rateLimit: "landing",
  },
  async ({ actor, params }) => {
    const res = await sendCampaignNow(
      actor.id,
      params.publicId!,
      params.campaignId!
    )
    if (!res.ok) {
      return NextResponse.json({ error: res.error }, { status: res.status })
    }
    return NextResponse.json({ created: res.created })
  }
)
