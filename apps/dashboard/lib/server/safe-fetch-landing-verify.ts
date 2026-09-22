import dns from "node:dns/promises"
import http from "node:http"
import https from "node:https"
import net from "node:net"
import type { IncomingMessage } from "node:http"

export function isUnsafeIp(ip: string): boolean {
  const normalized = normalizeIpAddress(ip)
  if (!normalized) return true
  if (normalized.kind === "ipv4") return isUnsafeIpv4(normalized.address)
  return isUnsafeIpv6(normalized.address)
}

function normalizeIpAddress(
  ip: string
):
  | { kind: "ipv4"; address: string }
  | { kind: "ipv6"; address: string }
  | null {
  const raw = ip.trim().toLowerCase()
  if (!raw) return null

  const mapped = extractIpv4Mapped(raw)
  if (mapped) return { kind: "ipv4", address: mapped }

  if (net.isIPv4(raw)) return { kind: "ipv4", address: raw }
  if (net.isIPv6(raw)) return { kind: "ipv6", address: raw }
  return null
}

function extractIpv4Mapped(ip: string): string | null {
  if (ip.startsWith("::ffff:")) {
    const rest = ip.slice("::ffff:".length)
    if (net.isIPv4(rest)) return rest
    const hex = rest.match(/^([0-9a-f]{1,4}):([0-9a-f]{1,4})$/i)
    if (hex) {
      const hi = Number.parseInt(hex[1]!, 16)
      const lo = Number.parseInt(hex[2]!, 16)
      if (!Number.isFinite(hi) || !Number.isFinite(lo)) return null
      return `${(hi >> 8) & 255}.${hi & 255}.${(lo >> 8) & 255}.${lo & 255}`
    }
  }
  return null
}

function isUnsafeIpv4(ip: string): boolean {
  const p = ip.split(".").map((x) => Number.parseInt(x, 10))
  if (
    p.length !== 4 ||
    p.some((n) => !Number.isFinite(n) || n < 0 || n > 255)
  ) {
    return true
  }
  const a = p[0]!
  const b = p[1]!
  if (a === 0 || a === 255) return true
  if (a === 10) return true
  if (a === 127) return true
  if (a === 169 && b === 254) return true
  if (a === 172 && b >= 16 && b <= 31) return true
  if (a === 192 && b === 168) return true
  if (a === 100 && b >= 64 && b <= 127) return true
  return false
}

function isUnsafeIpv6(ip: string): boolean {
  if (ip === "::" || ip === "::1") return true
  if (ip.startsWith("fe80:")) return true
  if (ip.startsWith("ff")) return true
  if (ip.startsWith("fc") || ip.startsWith("fd")) return true
  return false
}

async function resolveSafeAddresses(hostname: string): Promise<string[]> {
  const resolved = await dns.lookup(hostname, { all: true, verbatim: true })
  if (resolved.length === 0) {
    throw new Error("PRIVATE_OR_LOCAL_HOST")
  }
  const addresses: string[] = []
  for (const addr of resolved) {
    if (isUnsafeIp(addr.address)) {
      throw new Error("PRIVATE_OR_LOCAL_HOST")
    }
    addresses.push(addr.address)
  }
  return addresses
}

const MAX_BODY_BYTES = 512_000
const MAX_REDIRECTS = 3

type PinnedResponse = {
  status: number
  headers: { get(name: string): string | null }
  body: AsyncIterable<Uint8Array> | null
}

function headerMap(res: IncomingMessage): {
  get(name: string): string | null
} {
  return {
    get(name: string) {
      const value = res.headers[name.toLowerCase()]
      if (Array.isArray(value)) return value[0] ?? null
      return value ?? null
    },
  }
}

async function fetchPinned(
  target: URL,
  pinnedIp: string,
  signal: AbortSignal
): Promise<PinnedResponse> {
  if (isUnsafeIp(pinnedIp)) {
    throw new Error("PRIVATE_OR_LOCAL_HOST")
  }

  const isHttps = target.protocol === "https:"
  const lib = isHttps ? https : http
  const port = target.port !== "" ? Number(target.port) : isHttps ? 443 : 80

  return new Promise((resolve, reject) => {
    const req = lib.request(
      {
        hostname: pinnedIp,
        servername: target.hostname,
        port,
        path: `${target.pathname}${target.search}`,
        method: "GET",
        headers: {
          Host: target.host,
          Accept: "text/html,application/xhtml+xml",
          "User-Agent": "ArohaaLandingVerifier/1.0 (+https://arohaa.com)",
          Connection: "close",
        },
        signal,
        timeout: 10_000,
      },
      (res) => {
        resolve({
          status: res.statusCode ?? 0,
          headers: headerMap(res),
          body: res,
        })
      }
    )
    req.on("error", reject)
    req.on("timeout", () => {
      req.destroy(new Error("TIMEOUT"))
    })
    req.end()
  })
}

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
    await resolveSafeAddresses(host)
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

    let addresses: string[]
    try {
      addresses = await resolveSafeAddresses(host)
    } catch {
      return { ok: false, reason: "PRIVATE_OR_LOCAL_HOST" }
    }

    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), 10_000)
    try {
      const pinnedIp = addresses[0]!
      const res = await fetchPinned(url, pinnedIp, controller.signal)

      if (res.status >= 300 && res.status < 400) {
        const loc = res.headers.get("location")
        if (res.body && "resume" in res.body) {
          ;(res.body as IncomingMessage).resume()
        }
        if (!loc) return { ok: false, reason: "REDIRECT_WITHOUT_LOCATION" }
        redirects += 1
        try {
          nextUrlStr = new URL(loc, url).href
        } catch {
          return { ok: false, reason: "BAD_REDIRECT_LOCATION" }
        }
        continue
      }

      if (res.status < 200 || res.status >= 300) {
        return { ok: false, reason: `HTTP_${res.status}` }
      }

      if (!res.body) return { ok: false, reason: "NO_BODY" }

      const chunks: Buffer[] = []
      let received = 0
      for await (const chunk of res.body) {
        const buf = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)
        received += buf.byteLength
        if (received > MAX_BODY_BYTES) {
          return { ok: false, reason: "BODY_TOO_LARGE" }
        }
        chunks.push(buf)
      }

      const text = Buffer.concat(chunks).toString("utf8")
      return { ok: true, text }
    } catch {
      return { ok: false, reason: "FETCH_FAILED" }
    } finally {
      clearTimeout(timer)
    }
  }

  return { ok: false, reason: "TOO_MANY_REDIRECTS" }
}

const META_TAG_RE = /<meta\b[^>]*>/gi

function readHtmlAttribute(tag: string, name: string): string | null {
  const re = new RegExp(
    `\\b${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)'|([^\\s>]+))`,
    "i"
  )
  const match = tag.match(re)
  if (!match) return null
  return match[1] ?? match[2] ?? match[3] ?? null
}

export function landingHtmlIncludesVerificationToken(
  html: string,
  token: string
): boolean {
  if (!token) return false
  META_TAG_RE.lastIndex = 0
  let match: RegExpExecArray | null
  while ((match = META_TAG_RE.exec(html)) !== null) {
    const tag = match[0]
    const name = readHtmlAttribute(tag, "name")
    const content = readHtmlAttribute(tag, "content")
    if (
      name != null &&
      name.toLowerCase() === "arohaa-verify" &&
      content === token
    ) {
      return true
    }
  }
  return false
}
