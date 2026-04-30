import type { NextAuthConfig } from "next-auth"

export const authConfig = {
  trustHost: true,
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

        const isTwoFactorEnabled = (auth.user as any)?.isTwoFactorEnabled
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
