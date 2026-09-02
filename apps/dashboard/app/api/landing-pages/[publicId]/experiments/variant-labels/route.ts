import { NextResponse } from "next/server"
import { getActiveLandingPageForActor } from "@/lib/server/landing-pages-store"
import { getVariantLabelPlanForLandingPage } from "@/lib/server/experiments-store"
import { route } from "@/lib/server/route"

export const GET = route(
  {
    permission: "landing_pages.read",
    actor: "read",
    tab: "experiments",
    rateLimit: "landing",
  },
  async ({ actor, params }) => {
    const parent = await getActiveLandingPageForActor(
      actor.id,
      params.publicId!
    )
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
)
