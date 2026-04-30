import { auth } from "./auth"
import type { NextMiddleware } from "next/server"

export const proxy: NextMiddleware = auth as unknown as NextMiddleware

export const config = {
  matcher: [
    "/((?!api/ingest|_next/static|_next/image|favicon.ico|.*\\.svg$).*)",
  ],
}
