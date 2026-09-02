import { NextResponse } from "next/server"
import { isUtmFilterDimension } from "@/features/dashboard/model/utm-attribution-filter"
import { loadUtmDashboardDataForApi } from "@/lib/server/utm-dashboard-load"
import { route } from "@/lib/server/route"

export const GET = route(
  {
    permission: "landing_pages.read",
    actor: "read",
    tab: "utm",
    rateLimit: "landing",
  },
  async ({ params, request }) => {
    const dim = new URL(request.url).searchParams.get("dim")
    if (!isUtmFilterDimension(dim)) {
      return NextResponse.json({ error: "Invalid dim" }, { status: 400 })
    }

    const res = await loadUtmDashboardDataForApi(params.publicId!)
    if (!res.ok) {
      return NextResponse.json({ error: res.error }, { status: res.status })
    }

    const values = [
      ...new Set(
        res.data.items
          .filter((item) => item.key === dim)
          .map((item) => item.value)
          .filter(Boolean)
      ),
    ].sort((a, b) => a.localeCompare(b, undefined, { sensitivity: "base" }))

    return NextResponse.json(values)
  }
)
