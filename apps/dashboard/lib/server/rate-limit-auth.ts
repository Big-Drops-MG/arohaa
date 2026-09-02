import "server-only"

import { Ratelimit } from "@upstash/ratelimit"
import { Redis } from "@upstash/redis"

const GENERIC_AUTH_ERROR = "Invalid credentials or authenticator code."
const UNAVAILABLE_ERROR = "Service temporarily unavailable. Try again shortly."

let authLimiter: Ratelimit | null | undefined

function getRedis(): Redis | null {
  const url = process.env.KV_REST_API_URL?.trim()
  const token = process.env.KV_REST_API_TOKEN?.trim()
  if (!url || !token) return null
  return new Redis({ url, token })
}

function getAuthLimiter(): Ratelimit | null {
  if (authLimiter !== undefined) return authLimiter
  const redis = getRedis()
  if (!redis) {
    authLimiter = null
    return null
  }
  authLimiter = new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(10, "10 m"),
    prefix: "arohaa:auth",
  })
  return authLimiter
}

export function authGenericError(): string {
  return GENERIC_AUTH_ERROR
}

export async function enforceAuthRateLimit(params: {
  ip: string
  email: string
}): Promise<{ error: string } | null> {
  const limiter = getAuthLimiter()
  if (!limiter) {
    if (process.env.NODE_ENV === "production") {
      return { error: UNAVAILABLE_ERROR }
    }
    return null
  }

  const ipKey = `ip:${params.ip || "unknown"}`
  const emailKey = `email:${params.email.toLowerCase() || "unknown"}`

  const [ipResult, emailResult] = await Promise.all([
    limiter.limit(ipKey),
    limiter.limit(emailKey),
  ])

  if (!ipResult.success || !emailResult.success) {
    return { error: "Too many attempts. Try again shortly." }
  }
  return null
}
