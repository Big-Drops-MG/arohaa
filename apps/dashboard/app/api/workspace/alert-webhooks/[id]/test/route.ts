import type { NextRequest } from "next/server"
import { NextResponse } from "next/server"
import { requireLandingPageActor } from "@/lib/server/landing-auth"
import { testWorkspaceAlertWebhook } from "@/lib/server/workspace-alert-webhooks"
import { enforceLandingApiRateLimit } from "@/lib/server/rate-limit-landing"

type RouteContext = {
  params: Promise<{ id: string }>
}

export async function POST(_request: NextRequest, context: RouteContext) {
  const actor = await requireLandingPageActor()
  if (!actor) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }
  const limited = await enforceLandingApiRateLimit(actor.id)
  if (limited) return limited

  const { id } = await context.params
  const result = await testWorkspaceAlertWebhook(actor.id, id)

  if ("error" in result && !("item" in result)) {
    return NextResponse.json({ error: result.error }, { status: 404 })
  }

  if (!result.success) {
    return NextResponse.json(
      {
        item: result.item,
        success: false,
        error: result.error,
      },
      { status: 502 }
    )
  }

  return NextResponse.json({ item: result.item, success: true })
}
