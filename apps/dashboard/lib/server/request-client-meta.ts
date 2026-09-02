import { headers } from "next/headers"

type RequestWithHeaders = Pick<Request, "headers"> & { ip?: string }

const LOOPBACK = new Set(["127.0.0.1", "::1", "0:0:0:0:0:0:0:1", "localhost"])

function normalizeIp(raw: string | null | undefined): string | null {
  if (!raw) return null
  let value = raw.split(",")[0]?.trim() ?? ""
  if (!value) return null

  if (value.startsWith("[") && value.endsWith("]")) {
    value = value.slice(1, -1)
  }

  if (/^\d{1,3}(\.\d{1,3}){3}:\d+$/.test(value)) {
    value = value.replace(/:\d+$/, "")
  }

  if (value.startsWith("::ffff:")) value = value.slice("::ffff:".length)
  if (LOOPBACK.has(value.toLowerCase())) return "127.0.0.1"
  return value || null
}

function firstHeaderIp(
  headerStore: Headers | { get(name: string): string | null },
  names: string[]
): string | null {
  for (const name of names) {
    const parsed = normalizeIp(headerStore.get(name))
    if (parsed) return parsed
  }
  return null
}

export function clientIpFromHeaders(
  headerStore: Headers | { get(name: string): string | null }
): string | null {
  return firstHeaderIp(headerStore, [
    "x-vercel-forwarded-for",
    "cf-connecting-ip",
    "true-client-ip",
    "x-real-ip",
    "x-client-ip",
    "x-forwarded-for",
    "fly-client-ip",
  ])
}

export function clientIpFromRequest(
  request: RequestWithHeaders
): string | null {
  const fromHeaders = clientIpFromHeaders(request.headers)
  if (fromHeaders) return fromHeaders

  const fromRequest = normalizeIp(request.ip)
  if (fromRequest) return fromRequest

  if (process.env.NODE_ENV !== "production") {
    return "127.0.0.1"
  }

  return null
}

export async function clientIpFromNextHeaders(): Promise<string | null> {
  const h = await headers()
  return (
    clientIpFromHeaders(h) ??
    (process.env.NODE_ENV !== "production" ? "127.0.0.1" : null)
  )
}

export function userAgentFromHeaders(
  headerStore: Headers | { get(name: string): string | null }
): string | null {
  const ua = headerStore.get("user-agent")?.trim()
  return ua || null
}

export function userAgentFromRequest(
  request: RequestWithHeaders
): string | null {
  return userAgentFromHeaders(request.headers)
}
