import { NextResponse } from "next/server"
import { isUtmFilterDimension } from "@/features/dashboard/model/utm-attribution-filter"
import {
  resolveIngestApiBase,
  resolveInternalApiSecret,
} from "@/lib/server/analytics-env"
import { requireLandingPageActor } from "@/lib/server/landing-auth"
import { getActiveLandingPageForActor } from "@/lib/server/landing-pages-store"
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

    const actor = await requireLandingPageActor()
    if (!actor) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const row = await getActiveLandingPageForActor(actor.id, params.publicId!)
    if (!row) {
      return NextResponse.json({ error: "Not found" }, { status: 404 })
    }

    const apiBase = resolveIngestApiBase()
    const secret = resolveInternalApiSecret()
    if (!apiBase || !secret) {
      return NextResponse.json([])
    }

    try {
      const url = new URL(`${apiBase}/v1/analytics/utm-values`)
      url.searchParams.set("workspace_id", row.id)
      url.searchParams.set("dim", dim)
      const resp = await fetch(url.toString(), {
        headers: { "x-arohaa-internal": secret },
        cache: "no-store",
        signal: AbortSignal.timeout(15_000),
      })
      if (!resp.ok) {
        return NextResponse.json([])
      }
      const values = (await resp.json()) as string[]
      return NextResponse.json(Array.isArray(values) ? values : [])
    } catch {
      return NextResponse.json([])
    }
  }
)
