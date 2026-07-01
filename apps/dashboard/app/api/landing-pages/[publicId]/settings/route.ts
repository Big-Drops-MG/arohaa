import { NextResponse } from "next/server"
import { loadLandingPageSettingsDataForApi } from "@/lib/server/landing-page-settings-load"
import { enforceLandingApiRateLimit } from "@/lib/server/rate-limit-landing"
import { requireLandingPageActor } from "@/lib/server/landing-auth"

export async function GET(
  _request: Request,
  context: { params: Promise<{ publicId: string }> }
) {
  const actor = await requireLandingPageActor()
  if (!actor) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }
  const limited = await enforceLandingApiRateLimit(actor.id)
  if (limited) return limited

  const { publicId } = await context.params
  const result = await loadLandingPageSettingsDataForApi(publicId)
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status })
  }

  return NextResponse.json(result.data)
}
