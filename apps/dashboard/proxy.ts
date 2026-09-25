import { NextResponse } from "next/server"
import type { NextFetchEvent, NextRequest } from "next/server"
import { auth } from "./auth"

const APEX_HOST = "arohaa.net"
const CANONICAL_HOST = "www.arohaa.net"

type AuthMiddleware = (
  request: NextRequest,
  event: NextFetchEvent
) => ReturnType<typeof NextResponse.next> | Promise<Response | undefined>

const authMiddleware = auth as unknown as AuthMiddleware

export async function proxy(request: NextRequest, event: NextFetchEvent) {
  const host = request.headers.get("host")?.split(":")[0]?.toLowerCase()
  if (host === APEX_HOST) {
    const url = request.nextUrl.clone()
    url.protocol = "https:"
    url.host = CANONICAL_HOST
    url.port = ""
    return NextResponse.redirect(url, 308)
  }

  return authMiddleware(request, event)
}

export const config = {
  matcher: [
    "/((?!api/ingest|_next/static|_next/image|favicon.ico|favicon.png|geo/|.*\\.svg$|.*\\.geojson$).*)",
  ],
}
