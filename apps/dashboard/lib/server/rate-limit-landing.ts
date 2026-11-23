import { Ratelimit } from "@upstash/ratelimit"
import { Redis } from "@upstash/redis"
import { NextResponse } from "next/server"

let ratelimit: Ratelimit | null | undefined

/** Process-local cache: skips Redis when the decision is still clearly allowed. */
const ephemeralCache = new Map()

function getRedis(): Redis | null {
  const url = process.env.KV_REST_API_URL?.trim()
  const token = process.env.KV_REST_API_TOKEN?.trim()
  if (!url || !token) return null
  return new Redis({ url, token })
}

function getLimiter(): Ratelimit | null {
  if (ratelimit !== undefined) return ratelimit
  const redis = getRedis()
  if (!redis) {
    ratelimit = null
    return null
  }
  // cachedFixedWindow + ephemeralCache cuts EVALSHA/INCR chatter vs slidingWindow
  // without weakening the per-user ceiling under normal dashboard use.
  ratelimit = new Ratelimit({
    redis,
    limiter: Ratelimit.cachedFixedWindow(120, "1 m"),
    prefix: "arohaa:landing-api",
    ephemeralCache,
  })
  return ratelimit
}

export async function enforceLandingApiRateLimit(
  actorId: string
): Promise<NextResponse | null> {
  const limiter = getLimiter()
  if (!limiter) {
    if (process.env.NODE_ENV === "production") {
      return NextResponse.json(
        { error: "Service temporarily unavailable. Try again shortly." },
        { status: 503 }
      )
    }
    return null
  }

  const { success } = await limiter.limit(`user:${actorId}`)
  if (success) return null

  return NextResponse.json(
    { error: "Too many requests. Try again shortly." },
    { status: 429, headers: { "Retry-After": "60" } }
  )
}
