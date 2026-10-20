import { NextResponse } from "next/server"
import { canReviewWarehouseLeads } from "@/lib/server/actor-can"
import { requireLandingPageActor } from "@/lib/server/landing-auth"

export async function requireWarehouseReviewer() {
  const actor = await requireLandingPageActor()
  if (!actor) {
    return {
      ok: false as const,
      response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    }
  }
  if (!(await canReviewWarehouseLeads(actor))) {
    return {
      ok: false as const,
      response: NextResponse.json({ error: "Forbidden" }, { status: 403 }),
    }
  }
  return { ok: true as const, actor }
}
