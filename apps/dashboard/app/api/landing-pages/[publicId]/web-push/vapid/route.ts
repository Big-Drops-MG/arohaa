import { NextResponse } from "next/server"
import { z } from "zod"
import { route } from "@/lib/server/route"
import { generateVapidForLanding } from "@/lib/server/web-push-dashboard"

const bodySchema = z.object({
  subject: z.string().max(200).optional(),
})

export const POST = route(
  {
    permission: "landing_pages.write",
    actor: "write",
    tab: "notification-center",
    rateLimit: "landing",
    schema: bodySchema,
  },
  async ({ actor, params, body }) => {
    const res = await generateVapidForLanding(
      actor.id,
      params.publicId!,
      body.subject
    )
    if (!res.ok) {
      return NextResponse.json({ error: res.error }, { status: res.status })
    }
    return NextResponse.json({ publicKey: res.publicKey })
  }
)
