import dns from "node:dns/promises"
import net from "node:net"

function isUnsafeIp(ip: string): boolean {
  if (net.isIP(ip) === 0) return true
  if (!net.isIPv4(ip)) {
    const low = ip.toLowerCase()
    if (low === "::1" || low.startsWith("fe80:")) return true
    if (low.startsWith("fc") || low.startsWith("fd")) return true
    return false
  }
  const p = ip.split(".").map((x) => Number.parseInt(x, 10))
  if (p.length !== 4 || p.some((n) => !Number.isFinite(n))) return true
  const a = p[0]!
  const b = p[1]!
  if (a === 10) return true
  if (a === 127) return true
  if (a === 169 && b === 254) return true
  if (a === 172 && b >= 16 && b <= 31) return true
  if (a === 192 && b === 168) return true
  if (a === 0 || a === 255) return true
  return false
}

async function assertSafeHostname(hostname: string): Promise<void> {
  const resolved = await dns.lookup(hostname, { all: true, verbatim: false })
  for (const addr of resolved) {
    if (isUnsafeIp(addr.address)) {
      throw new Error("PRIVATE_OR_LOCAL_HOST")
    }
  }
}

const MAX_BODY_BYTES = 512_000
const MAX_REDIRECTS = 3

export async function fetchLandingHtmlForVerification(
  landingNormalizedUrl: string,
  expectedHostnameLower: string
): Promise<{ ok: true; text: string } | { ok: false; reason: string }> {
  let nextUrlStr = landingNormalizedUrl
  let redirects = 0

  try {
    const initial = new URL(landingNormalizedUrl)
    if (initial.protocol !== "https:" && initial.protocol !== "http:") {
      return { ok: false, reason: "UNSUPPORTED_SCHEME" }
    }
    const host = initial.hostname.toLowerCase()
    if (host !== expectedHostnameLower) {
      return { ok: false, reason: "HOST_MISMATCH" }
    }
    await assertSafeHostname(host)
  } catch {
    return { ok: false, reason: "INVALID_URL_OR_DNS" }
  }

  while (redirects <= MAX_REDIRECTS) {
    let url: URL
    try {
      url = new URL(nextUrlStr)
    } catch {
      return { ok: false, reason: "BAD_URL" }
    }

    if (url.protocol !== "http:" && url.protocol !== "https:") {
      return { ok: false, reason: "UNSUPPORTED_SCHEME" }
    }

    const host = url.hostname.toLowerCase()
    if (host !== expectedHostnameLower) {
      return { ok: false, reason: "REDIRECT_HOST_MISMATCH" }
    }

    try {
      await assertSafeHostname(host)
    } catch {
      return { ok: false, reason: "PRIVATE_OR_LOCAL_HOST" }
    }

    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), 10_000)
    try {
      const res = await fetch(nextUrlStr, {
        method: "GET",
        redirect: "manual",
        signal: controller.signal,
        headers: {
          Accept: "text/html,application/xhtml+xml",
          "User-Agent": "ArohaaLandingVerifier/1.0 (+https://arohaa.com)",
        },
      })

      if (res.status >= 300 && res.status < 400) {
        const loc = res.headers.get("location")
        if (!loc) return { ok: false, reason: "REDIRECT_WITHOUT_LOCATION" }
        redirects += 1
        try {
          nextUrlStr = new URL(loc, url).href
        } catch {
          return { ok: false, reason: "BAD_REDIRECT_LOCATION" }
        }
        continue
      }

      if (!res.ok) {
        return { ok: false, reason: `HTTP_${res.status}` }
      }

      const reader = res.body?.getReader()
      if (!reader) return { ok: false, reason: "NO_BODY" }

      const chunks: Uint8Array[] = []
      let received = 0
      while (received < MAX_BODY_BYTES) {
        const { done, value } = await reader.read()
        if (done) break
        if (value) {
          chunks.push(value)
          received += value.byteLength
        }
      }

      await reader.cancel().catch(() => undefined)

      const decoder = new TextDecoder("utf-8", { fatal: false })
      const text = decoder.decode(
        Buffer.concat(
          chunks.map((u) => Buffer.from(u)),
          received
        )
      )
      return { ok: true, text }
    } catch {
      return { ok: false, reason: "FETCH_FAILED" }
    } finally {
      clearTimeout(timer)
    }
  }

  return { ok: false, reason: "TOO_MANY_REDIRECTS" }
}

export function landingHtmlIncludesVerificationToken(
  html: string,
  token: string
): boolean {
  if (!token) return false
  return html.includes(token)
}
