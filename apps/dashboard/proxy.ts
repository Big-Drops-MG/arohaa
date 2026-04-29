import NextAuth from "next-auth"
import type { NextMiddleware } from "next/server"
import { authConfig } from "./auth.config"

const { auth } = NextAuth(authConfig)

export const proxy: NextMiddleware = auth as NextMiddleware

export const config = {
  matcher: [
    "/((?!api/ingest|_next/static|_next/image|favicon.ico|.*\\.svg$).*)",
  ],
}
