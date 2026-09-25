import { NextResponse } from "next/server"
import { buildGscAuthorizeUrl } from "@workspace/database"
import { requireWritableLandingPageActor } from "@/lib/server/external-access"
import { getActiveLandingPageForActor } from "@/lib/server/landing-pages-store"
import {
  resolveGscOAuthRedirectUri,
  signGscOAuthState,
} from "@/lib/server/gsc-oauth-state"
import { route } from "@/lib/server/route"

export const GET = route(
  {
    permission: "landing_pages.write",
    actor: "write",
    tab: "seo",
    rateLimit: "landing",
  },
  async ({ actor, request }) => {
    const writable = await requireWritableLandingPageActor()
    if (!writable) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const url = new URL(request.url)
    const publicId = url.searchParams.get("public_id")?.trim()
    if (!publicId) {
      return NextResponse.json({ error: "public_id required" }, { status: 400 })
    }

    const lp = await getActiveLandingPageForActor(actor.id, publicId)
    if (!lp) {
      return NextResponse.json({ error: "Not found" }, { status: 404 })
    }

    if (
      !process.env.GSC_GOOGLE_CLIENT_ID?.trim() &&
      !process.env.GOOGLE_CLIENT_ID?.trim()
    ) {
      return NextResponse.json(
        { error: "Google Search Console OAuth is not configured" },
        { status: 503 }
      )
    }
    if (
      !process.env.GSC_GOOGLE_CLIENT_SECRET?.trim() &&
      !process.env.GOOGLE_CLIENT_SECRET?.trim()
    ) {
      return NextResponse.json(
        { error: "Google Search Console OAuth is not configured" },
        { status: 503 }
      )
    }

    let redirectUri: string
    try {
      redirectUri = resolveGscOAuthRedirectUri()
    } catch {
      return NextResponse.json(
        { error: "AUTH_URL is not configured" },
        { status: 503 }
      )
    }

    const state = signGscOAuthState({
      workspaceId: lp.workspaceId,
      publicId: lp.publicId,
      userId: actor.id,
    })

    const authorizeUrl = buildGscAuthorizeUrl({ redirectUri, state })
    return NextResponse.redirect(authorizeUrl)
  }
)
