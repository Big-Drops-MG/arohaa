import { NextResponse } from "next/server"
import { loadLandingPageSettingsDataForApi } from "@/lib/server/landing-page-settings-load"
import { route } from "@/lib/server/route"

export const GET = route(
  {
    permission: "landing_pages.read",
    actor: "read",
    tab: "settings",
    rateLimit: "landing",
  },
  async ({ params }) => {
    const result = await loadLandingPageSettingsDataForApi(params.publicId!)
    if (!result.ok) {
      return NextResponse.json(
        { error: result.error },
        { status: result.status }
      )
    }

    return NextResponse.json(result.data)
  }
)
