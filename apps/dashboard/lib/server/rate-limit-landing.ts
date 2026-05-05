import { Ratelimit } from "@upstash/ratelimit"
import { Redis } from "@upstash/redis"
import { NextResponse } from "next/server"

let ratelimit: Ratelimit | null = null

function getRedis(): Redis | null {
  const url = process.env.KV_REST_API_URL?.trim()
  const token = process.env.KV_REST_API_TOKEN?.trim()
  if (!url || !token) return null
  return new Redis({ url, token })
}

function getLimiter(): Ratelimit | null {
  if (ratelimit) return ratelimit
  const redis = getRedis()
  if (!redis) return null
  ratelimit = new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(120, "1 m"),
    prefix: "arohaa:landing-api",
  })
  return ratelimit
}

export async function enforceLandingApiRateLimit(
  actorId: string
): Promise<NextResponse | null> {
  const limiter = getLimiter()
  if (!limiter) return null

  const { success } = await limiter.limit(`user:${actorId}`)
  if (success) return null

  return NextResponse.json(
    { error: "Too many requests. Try again shortly." },
    { status: 429, headers: { "Retry-After": "60" } }
  )
}
