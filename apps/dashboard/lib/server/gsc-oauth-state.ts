import { createHmac, timingSafeEqual } from "node:crypto"

const STATE_TTL_MS = 15 * 60 * 1000

function stateSecret(): string {
  const secret =
    process.env.AUTH_SECRET?.trim() ||
    process.env.NEXTAUTH_SECRET?.trim() ||
    process.env.TOTP_ENCRYPTION_KEY?.trim()
  if (!secret) {
    throw new Error("AUTH_SECRET is required for GSC OAuth state")
  }
  return secret
}

export function signGscOAuthState(payload: {
  workspaceId: string
  publicId: string
  userId: string
}): string {
  const body = Buffer.from(
    JSON.stringify({
      ...payload,
      exp: Date.now() + STATE_TTL_MS,
    }),
    "utf8"
  ).toString("base64url")
  const sig = createHmac("sha256", stateSecret())
    .update(body)
    .digest("base64url")
  return `${body}.${sig}`
}

export function verifyGscOAuthState(state: string): {
  workspaceId: string
  publicId: string
  userId: string
} | null {
  const [body, sig] = state.split(".")
  if (!body || !sig) return null
  const expected = createHmac("sha256", stateSecret())
    .update(body)
    .digest("base64url")
  const a = Buffer.from(sig)
  const b = Buffer.from(expected)
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null
  try {
    const parsed = JSON.parse(
      Buffer.from(body, "base64url").toString("utf8")
    ) as {
      workspaceId?: string
      publicId?: string
      userId?: string
      exp?: number
    }
    if (
      !parsed.workspaceId ||
      !parsed.publicId ||
      !parsed.userId ||
      typeof parsed.exp !== "number" ||
      Date.now() > parsed.exp
    ) {
      return null
    }
    return {
      workspaceId: parsed.workspaceId,
      publicId: parsed.publicId,
      userId: parsed.userId,
    }
  } catch {
    return null
  }
}

export function resolveGscOAuthRedirectUri(): string {
  const base =
    process.env.AUTH_URL?.trim() ||
    process.env.NEXTAUTH_URL?.trim() ||
    process.env.NEXT_PUBLIC_APP_URL?.trim()
  if (!base) {
    throw new Error("AUTH_URL is required for GSC OAuth redirect")
  }
  return `${base.replace(/\/$/, "")}/api/integrations/gsc/callback`
}
