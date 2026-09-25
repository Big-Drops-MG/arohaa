import { NextResponse } from "next/server"
import {
  db,
  encryptVapidPrivateKey,
  eq,
  exchangeGscAuthCode,
  workspaceGscConnections,
} from "@workspace/database"
import {
  resolveGscOAuthRedirectUri,
  verifyGscOAuthState,
} from "@/lib/server/gsc-oauth-state"

export async function GET(request: Request) {
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
