import type { NextRequest } from "next/server"
import { NextResponse } from "next/server"
import { requireLandingPageActor } from "@/lib/server/landing-auth"
import { revokeWorkspaceApiKey } from "@/lib/server/workspace-api-keys"
import { enforceLandingApiRateLimit } from "@/lib/server/rate-limit-landing"

type RouteContext = {
  params: Promise<{ id: string }>
}

export async function DELETE(_request: NextRequest, context: RouteContext) {
  const actor = await requireLandingPageActor()
  if (!actor) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }
  const limited = await enforceLandingApiRateLimit(actor.id)
  if (limited) return limited

  const { id } = await context.params
  const result = await revokeWorkspaceApiKey(actor.id, id)
  if ("error" in result) {
    return NextResponse.json({ error: result.error }, { status: 404 })
  }

  return NextResponse.json({ ok: true })
}
