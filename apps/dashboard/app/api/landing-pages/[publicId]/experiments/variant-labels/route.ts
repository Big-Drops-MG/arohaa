import { NextResponse } from "next/server"
import { requireLandingPageActor } from "@/lib/server/landing-auth"
import { getActiveLandingPageForActor } from "@/lib/server/landing-pages-store"
import { getVariantLabelPlanForLandingPage } from "@/lib/server/experiments-store"
import { enforceLandingApiRateLimit } from "@/lib/server/rate-limit-landing"

export async function GET(
  _request: Request,
  props: { params: Promise<{ publicId: string }> }
) {
  const actor = await requireLandingPageActor()
  if (!actor) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }
  const limited = await enforceLandingApiRateLimit(actor.id)
  if (limited) return limited

  const { publicId } = await props.params
  const parent = await getActiveLandingPageForActor(actor.id, publicId)
  if (!parent) {
    return NextResponse.json({ error: "Not found" }, { status: 404 })
  }

  const plan = await getVariantLabelPlanForLandingPage(parent)
  return NextResponse.json({
    ...plan,
    parent: {
      publicId: parent.publicId,
      brandName: parent.brandName,
      formType: parent.formType,
    },
  })
}
