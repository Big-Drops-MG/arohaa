import "server-only"

/** Production dashboard host used when env URLs are missing or invalid. */
export const PRODUCTION_APP_BASE_URL = "https://www.arohaa.net"

/** Hosts that were configured historically but have no DNS / are not the app. */
const DEAD_APP_HOSTS = new Set(["dashboard.arohaa.com", "dashboard.arohaa.net"])

function normalizeAppBaseUrl(raw: string): string {
  const trimmed = raw.trim().replace(/\/$/, "")
  if (!trimmed) return PRODUCTION_APP_BASE_URL
  try {
    const url = new URL(
      trimmed.includes("://") ? trimmed : `https://${trimmed}`
    )
    if (DEAD_APP_HOSTS.has(url.hostname.toLowerCase())) {
      return PRODUCTION_APP_BASE_URL
    }
    return `${url.protocol}//${url.host}`
  } catch {
    return PRODUCTION_APP_BASE_URL
  }
}

/**
 * Public origin for password-reset, invite, and access emails.
 * Prefer NEXT_PUBLIC_APP_URL, then NEXTAUTH_URL / AUTH_URL, then VERCEL_URL.
 */
export function resolveAppBaseUrl(): string {
  const fromEnv =
    process.env.NEXT_PUBLIC_APP_URL ||
    process.env.NEXTAUTH_URL ||
    process.env.AUTH_URL
  if (fromEnv) {
    return normalizeAppBaseUrl(fromEnv)
  }
  if (process.env.VERCEL_URL) {
    return normalizeAppBaseUrl(`https://${process.env.VERCEL_URL}`)
  }
  if (process.env.NODE_ENV === "production") {
    return PRODUCTION_APP_BASE_URL
  }
  return "http://localhost:3000"
}
