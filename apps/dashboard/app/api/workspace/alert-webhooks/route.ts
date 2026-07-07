import type { NextRequest } from "next/server"
import { NextResponse } from "next/server"
import { requireLandingPageActor } from "@/lib/server/landing-auth"
import {
  createWorkspaceAlertWebhook,
  listWorkspaceAlertWebhooks,
} from "@/lib/server/workspace-alert-webhooks"
import { enforceLandingApiRateLimit } from "@/lib/server/rate-limit-landing"

export async function GET() {
  const actor = await requireLandingPageActor()
  if (!actor) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }
  const limited = await enforceLandingApiRateLimit(actor.id)
  if (limited) return limited

  const items = await listWorkspaceAlertWebhooks(actor.id)
  return NextResponse.json({ items })
}

export async function POST(request: NextRequest) {
  const actor = await requireLandingPageActor()
  if (!actor) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }
  const limited = await enforceLandingApiRateLimit(actor.id)
  if (limited) return limited

  let body: { name?: string; url?: string }
  try {
    body = (await request.json()) as { name?: string; url?: string }
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 })
  }

  const result = await createWorkspaceAlertWebhook(actor.id, {
    name: body.name ?? "",
    url: body.url ?? "",
  })
  if ("error" in result) {
    return NextResponse.json({ error: result.error }, { status: 400 })
  }

  return NextResponse.json({ item: result.item })
}
