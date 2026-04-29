import { UAParser } from 'ua-parser-js'
import type { FastifyRequest } from 'fastify'

export interface UserAgentInfo {
  browser: string
  os: string
  device: string
}

export interface GeoInfo {
  country: string
  city: string
}

export interface EnrichmentContext {
  ip: string
  ua: UserAgentInfo
  geo: GeoInfo
}

const MAX_UA_LEN = 1024

export function parseUserAgent(uaHeader: string | undefined): UserAgentInfo {
  if (!uaHeader) {
    return { browser: 'Unknown', os: 'Unknown', device: 'desktop' }
  }
  const safe = uaHeader.length > MAX_UA_LEN ? uaHeader.slice(0, MAX_UA_LEN) : uaHeader
  const parser = new UAParser(safe)

  const browser = parser.getBrowser().name?.trim() || 'Unknown'
  const os = parser.getOS().name?.trim() || 'Unknown'
  const rawDevice = parser.getDevice().type?.trim()

  const device =
    rawDevice === 'mobile' || rawDevice === 'tablet' || rawDevice === 'wearable' || rawDevice === 'console' || rawDevice === 'smarttv' || rawDevice === 'embedded'
      ? rawDevice
      : 'desktop'

  return { browser, os, device }
}

export function extractClientIp(request: FastifyRequest): string {
  const ip = request.ip
  if (typeof ip !== 'string' || ip.length === 0) return ''

  if (ip.startsWith('::ffff:')) return ip.slice('::ffff:'.length)
  return ip
}

export function lookupGeo(_ip: string): GeoInfo {
  return { country: 'Unknown', city: '' }
}

export function buildEnrichmentContext(
  request: FastifyRequest,
): EnrichmentContext {
  const ip = extractClientIp(request)
  const uaHeader = request.headers['user-agent']
  const ua = parseUserAgent(typeof uaHeader === 'string' ? uaHeader : undefined)
  const geo = lookupGeo(ip)
  return { ip, ua, geo }
}
