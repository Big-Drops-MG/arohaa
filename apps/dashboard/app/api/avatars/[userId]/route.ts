import { createHash } from "node:crypto"
import { eq } from "drizzle-orm"
import { NextResponse } from "next/server"
import { auth } from "@/auth"
import {
  GOOGLE_DEFAULT_AVATAR_SHA256,
  normalizeGooglePhotoUrl,
} from "@/lib/server/google-profile-image"
import { db, users } from "@workspace/database"

export const runtime = "nodejs"

type RouteContext = {
  params: Promise<{ userId: string }>
}

export async function GET(_request: Request, context: RouteContext) {
  const session = await auth()
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { userId } = await context.params
  if (!userId || userId.length > 128) {
    return NextResponse.json({ error: "Not found" }, { status: 404 })
  }

  const [row] = await db
    .select({ image: users.image })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1)

  const raw = row?.image?.trim()
  if (!raw) {
    return new NextResponse(null, { status: 404 })
  }

  const upstreamUrl = normalizeGooglePhotoUrl(raw)

  try {
    const upstream = await fetch(upstreamUrl, {
      headers: { "User-Agent": "Mozilla/5.0" },
      cache: "no-store",
      redirect: "follow",
      signal: AbortSignal.timeout(8_000),
    })
    if (!upstream.ok) {
      return new NextResponse(null, { status: 404 })
    }

    const contentType = upstream.headers.get("content-type") ?? ""
    if (!contentType.startsWith("image/")) {
      return new NextResponse(null, { status: 404 })
    }

    const bytes = Buffer.from(await upstream.arrayBuffer())
    if (bytes.byteLength < 32) {
      return new NextResponse(null, { status: 404 })
    }

    const hash = createHash("sha256").update(bytes).digest("hex")
    if (hash === GOOGLE_DEFAULT_AVATAR_SHA256) {
      return new NextResponse(null, { status: 404 })
    }

    return new NextResponse(bytes, {
      status: 200,
      headers: {
        "Content-Type": contentType,
        "Cache-Control": "private, max-age=3600, stale-while-revalidate=86400",
        ETag: `"${hash.slice(0, 32)}"`,
      },
    })
  } catch {
    return new NextResponse(null, { status: 404 })
  }
}
