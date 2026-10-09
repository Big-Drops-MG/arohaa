import { NextResponse } from "next/server"
import {
  db,
  encryptVapidPrivateKey,
  exchangeGscAuthCode,
  workspaceGscConnections,
} from "@workspace/database"
import { gscOAuthActorMatchesState } from "@/lib/server/gsc-oauth-actor"
import {
  resolveGscOAuthRedirectUri,
  verifyGscOAuthState,
} from "@/lib/server/gsc-oauth-state"
import { getActiveLandingPageForActor } from "@/lib/server/landing-pages-store"
import { route } from "@/lib/server/route"

export const GET = route(
  {
    permission: "landing_pages.write",
    actor: "write",
    tab: "seo",
    rateLimit: "landing",
  },
  async ({ actor, request }) => {
    const url = new URL(request.url)
    const code = url.searchParams.get("code")?.trim()
    const stateRaw = url.searchParams.get("state")?.trim()
    const error = url.searchParams.get("error")?.trim()

    const failRedirect = (publicId: string | null, message: string) => {
      const dest = publicId
        ? `/dashboard/${encodeURIComponent(publicId)}?tab=seo&gsc_error=${encodeURIComponent(message)}`
        : `/dashboard?gsc_error=${encodeURIComponent(message)}`
      return NextResponse.redirect(new URL(dest, url.origin))
    }

    if (error) {
      const state = stateRaw ? verifyGscOAuthState(stateRaw) : null
      return failRedirect(state?.publicId ?? null, error)
    }

    if (!code || !stateRaw) {
      return failRedirect(null, "missing_code")
    }

    const state = verifyGscOAuthState(stateRaw)
    if (!state) {
      return failRedirect(null, "invalid_state")
    }

    if (!gscOAuthActorMatchesState(actor.id, state.userId)) {
      return failRedirect(state.publicId, "session_mismatch")
    }

    const lp = await getActiveLandingPageForActor(actor.id, state.publicId)
    if (!lp || lp.workspaceId !== state.workspaceId) {
      return failRedirect(state.publicId, "forbidden")
    }

    let redirectUri: string
    try {
      redirectUri = resolveGscOAuthRedirectUri()
    } catch {
      return failRedirect(state.publicId, "auth_url_missing")
    }

    try {
      const tokens = await exchangeGscAuthCode(code, redirectUri)
      const encrypted = encryptVapidPrivateKey(tokens.refreshToken)
      const now = new Date()

      await db
        .insert(workspaceGscConnections)
        .values({
          workspaceId: state.workspaceId,
          refreshTokenEncrypted: encrypted,
          googleAccountEmail: tokens.email ?? null,
          status: "active",
          connectedAt: now,
          updatedAt: now,
        })
        .onConflictDoUpdate({
          target: workspaceGscConnections.workspaceId,
          set: {
            refreshTokenEncrypted: encrypted,
            googleAccountEmail: tokens.email ?? null,
            status: "active",
            connectedAt: now,
            updatedAt: now,
          },
        })

      return NextResponse.redirect(
        new URL(
          `/dashboard/${encodeURIComponent(state.publicId)}?tab=seo&gsc=connected`,
          url.origin
        )
      )
    } catch (err) {
      console.error("GSC OAuth callback failed", err)
      return failRedirect(state.publicId, "exchange_failed")
    }
  }
)
