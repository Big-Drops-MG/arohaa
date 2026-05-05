import type { NextAuthConfig } from "next-auth"
import { config as loadEnv } from "dotenv"
import { existsSync } from "node:fs"
import { dirname, resolve } from "node:path"
import { fileURLToPath } from "node:url"

function bootstrapEnv(): void {
  const moduleDir = dirname(fileURLToPath(import.meta.url))
  const candidates = [
    resolve(process.cwd(), ".env"),
    resolve(process.cwd(), "../../.env"),
    resolve(moduleDir, "../../.env"),
  ]

  for (const path of candidates) {
    if (existsSync(path)) {
      loadEnv({ path, override: false })
    }
  }
}

bootstrapEnv()

const authSecret = process.env.AUTH_SECRET ?? process.env.NEXTAUTH_SECRET
if (!authSecret && process.env.NODE_ENV === "production") {
  throw new Error("Missing AUTH_SECRET (or NEXTAUTH_SECRET) in production")
}

function hasTwoFactorEnabled(user: unknown): boolean {
  if (!user || typeof user !== "object") return false
  const candidate = user as { isTwoFactorEnabled?: unknown }
  return candidate.isTwoFactorEnabled === true
}

export const authConfig = {
  trustHost: true,
  secret: authSecret,
  pages: {
    signIn: "/login",
    error: "/login",
  },
  callbacks: {
    authorized({ auth, request }) {
      const { nextUrl } = request
      const isLoggedIn = !!auth?.user
      const path = nextUrl.pathname
      const isOnDashboard = path.startsWith("/dashboard")
      const isAuthenticate = path.startsWith("/authenticate")
      const isApi = path.startsWith("/api")

      if (isOnDashboard) {
        if (!isLoggedIn) return false

        const isTwoFactorEnabled = hasTwoFactorEnabled(auth.user)
        const hasVerified2FA =
          request.cookies.get("arohaa_2fa_verified")?.value === "true"

        if (isTwoFactorEnabled && !hasVerified2FA) {
          return Response.redirect(
            new URL("/login?requiresTwoFactor=true", nextUrl)
          )
        }

        return true
      }

      if (isApi) {
        return true
      }

      if (path.startsWith("/login")) {
        return true
      }

      if (isLoggedIn && !isAuthenticate) {
        return Response.redirect(new URL("/dashboard", nextUrl))
      }

      return true
    },
  },
  providers: [],
} satisfies NextAuthConfig
