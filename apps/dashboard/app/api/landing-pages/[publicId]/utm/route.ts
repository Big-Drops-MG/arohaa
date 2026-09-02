import { NextResponse } from "next/server"
import {
  loadUtmDashboardDataForApi,
  updateUtmParamsForLandingPage,
} from "@/lib/server/utm-dashboard-load"
import { route } from "@/lib/server/route"
import { utmPutBodySchema } from "@/lib/server/route-schemas"

export const GET = route(
  {
    permission: "landing_pages.read",
    actor: "read",
    tab: "utm",
    rateLimit: "landing",
  },
  async ({ params }) => {
    const res = await loadUtmDashboardDataForApi(params.publicId!)

    if (!res.ok) {
      return NextResponse.json({ error: res.error }, { status: res.status })
    }

    return NextResponse.json(res.data)
  }
)

export const PUT = route(
  {
    permission: "landing_pages.write",
    actor: "write",
    tab: "utm",
    rateLimit: "landing",
    schema: utmPutBodySchema,
  },
  async ({ params, body }) => {
    const res = await updateUtmParamsForLandingPage({
      landingPagePublicId: params.publicId!,
      items: body.items,
    })

    if (!res.ok) {
      return NextResponse.json({ error: res.error }, { status: res.status })
    }

    return NextResponse.json(res.data)
  }
)
