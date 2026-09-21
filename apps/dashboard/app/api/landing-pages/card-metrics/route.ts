import { NextResponse } from "next/server"
import { getLandingPageCardMetricsByPublicId } from "@/features/dashboard/controller/landing-pages"
import { route } from "@/lib/server/route"

export const GET = route(
  {
    permission: "landing_pages.read",
    actor: "read",
    tab: "collection",
    rateLimit: "landing",
  },
  async () => {
    const metricsByPublicId = await getLandingPageCardMetricsByPublicId()
    return NextResponse.json({ metricsByPublicId })
  }
)
