import type { NextAuthConfig } from "next-auth"

export const authConfig = {
  trustHost: true,
  pages: {
    signIn: "/login",
    error: "/login",
  },
  callbacks: {
    authorized({ auth, request: { nextUrl } }) {
      const isLoggedIn = !!auth?.user
      const path = nextUrl.pathname
      const isOnDashboard = path.startsWith("/dashboard")
      const isAuthenticate = path.startsWith("/authenticate")
      const isApi = path.startsWith("/api")

      if (isOnDashboard) {
        if (isLoggedIn) return true
        return false
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
