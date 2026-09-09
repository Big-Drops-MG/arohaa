import "server-only"

import { cookies } from "next/headers"

const SESSION_COOKIE_BASES = [
  "__Secure-authjs.session-token.v2",
  "authjs.session-token.v2",
  "__Secure-authjs.session-token",
  "authjs.session-token",
  "__Secure-next-auth.session-token",
  "next-auth.session-token",
] as const

const CHUNK_SUFFIXES = ["", ".0", ".1", ".2", ".3", ".4"] as const

export async function clearAuthSessionCookies(): Promise<void> {
  const jar = await cookies()

  for (const base of SESSION_COOKIE_BASES) {
    const secure = base.startsWith("__Secure-")
    for (const suffix of CHUNK_SUFFIXES) {
      const name = `${base}${suffix}`
      try {
        jar.delete(name)
      } catch {
        /* ignore read-only jar edge cases */
      }
      try {
        jar.set(name, "", {
          httpOnly: true,
          sameSite: "lax",
          path: "/",
          secure,
          maxAge: 0,
          expires: new Date(0),
        })
      } catch {
        /* ignore */
      }
    }
  }
}
