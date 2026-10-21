import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import maxmind, { type AsnResponse, type Reader } from 'maxmind'

export type NetworkClass =
  | 'known_proxy_list'
  | 'hosting_network'
  | 'no_known_match'
  | 'unavailable'

export type NetworkClassification = {
  networkClass: NetworkClass
  asn: number | null
  org: string
  evidenceSource: string
  evidenceAsOf: string
  detail: string
}

export type NetworkDatasetHealth = {
  source: string
  publicationDate: string
  loadTime: string
  expiryPolicyDays: number
  expired: boolean
  supportedAddressFamilies: Array<'ipv4' | 'ipv6'>
  parseStatus: 'ok' | 'empty' | 'stale' | 'failed' | 'missing'
  proxyListStatus: 'ok' | 'empty' | 'stale' | 'failed' | 'missing'
  hostingAsnStatus: 'ok' | 'empty' | 'stale' | 'failed' | 'missing'
  asnDbStatus: 'ok' | 'missing' | 'failed'
  proxyCidrCount: number
  hostingAsnCount: number
}

type NetworkListFile = {
  asOf?: string
  source?: string
  expiresAfterDays?: number
  proxyCidrs?: string[]
  proxyCidrsV6?: string[]
  hostingAsns?: number[]
  hostingOrgPatterns?: string[]
}

type ParsedCidrV4 = { version: 4; network: number; mask: number }
type ParsedCidrV6 = { version: 6; network: bigint; maskBits: number }
type ParsedCidr = ParsedCidrV4 | ParsedCidrV6

type NetworkListCache = {
  asOf: string
  source: string
  loadedAt: string
  expiresAfterDays: number
  expired: boolean
  parseStatus: NetworkDatasetHealth['parseStatus']
  proxyCidrs: ParsedCidr[]
  hostingAsns: Set<number>
  hostingOrgPatterns: string[]
  addressFamilies: Array<'ipv4' | 'ipv6'>
}

const DEFAULT_EXPIRY_DAYS = 90

const UNAVAILABLE: NetworkClassification = {
  networkClass: 'unavailable',
  asn: null,
  org: '',
  evidenceSource: '',
  evidenceAsOf: '',
  detail: 'Network classification data unavailable or stale',
}

let listCache: NetworkListCache | null = null
let asnReader: Reader<AsnResponse> | null = null
let asnInitTried = false
let asnDbStatus: NetworkDatasetHealth['asnDbStatus'] = 'missing'

function candidateListPaths(): string[] {
  const configured = process.env.AROHAA_NETWORK_LIST_PATH?.trim()
  if (configured) return [configured]
  const apiRoot = fileURLToPath(new URL('../..', import.meta.url))
  const cwd = process.cwd()
  return [
    resolve(apiRoot, 'data/network-lists.json'),
    resolve(cwd, 'apps/api/data/network-lists.json'),
    resolve(cwd, 'data/network-lists.json'),
  ]
}

function candidateAsnPaths(): string[] {
  const configured = process.env.GEOIP_ASN_DB_PATH?.trim()
  if (configured) return [configured]
  const apiRoot = fileURLToPath(new URL('../..', import.meta.url))
  const cwd = process.cwd()
  return [
    resolve(cwd, 'geoip', 'dbip-asn-lite.mmdb'),
    resolve(apiRoot, 'geoip', 'dbip-asn-lite.mmdb'),
    resolve(cwd, 'apps', 'api', 'geoip', 'dbip-asn-lite.mmdb'),
  ]
}

function ipv4ToInt(ip: string): number | null {
  const parts = ip.split('.')
  if (parts.length !== 4) return null
  let n = 0
  for (const part of parts) {
    const octet = Number(part)
    if (!Number.isInteger(octet) || octet < 0 || octet > 255) return null
    n = (n << 8) + octet
  }
  return n >>> 0
}

function ipv6ToBigInt(ip: string): bigint | null {
  try {
    const normalized = ip.trim().toLowerCase()
    if (!normalized.includes(':')) return null
    const sides = normalized.split('::')
    if (sides.length > 2) return null
    const head = sides[0] ? sides[0].split(':').filter(Boolean) : []
    const tail = sides.length === 2 && sides[1] ? sides[1].split(':').filter(Boolean) : []
    if (head.length + tail.length > 8) return null
    const mid = Array(8 - head.length - tail.length).fill('0')
    const parts = [...head, ...mid, ...tail]
    if (parts.length !== 8) return null
    let value = 0n
    for (const part of parts) {
      if (!/^[0-9a-f]{1,4}$/.test(part)) return null
      value = (value << 16n) + BigInt(parseInt(part, 16))
    }
    return value
  } catch {
    return null
  }
}

function parseCidr(cidr: string): ParsedCidr | null {
  const [ip, bitsRaw] = cidr.trim().split('/')
  if (!ip || !bitsRaw) return null
  const bits = Number(bitsRaw)
  if (!Number.isInteger(bits)) return null
  if (ip.includes(':')) {
    if (bits < 0 || bits > 128) return null
    const base = ipv6ToBigInt(ip)
    if (base == null) return null
    return { version: 6, network: base, maskBits: bits }
  }
  if (bits < 0 || bits > 32) return null
  const base = ipv4ToInt(ip)
  if (base == null) return null
  const mask = bits === 0 ? 0 : (~0 << (32 - bits)) >>> 0
  return { version: 4, network: (base & mask) >>> 0, mask }
}

function isExpired(asOf: string, expiresAfterDays: number): boolean {
  if (!asOf) return true
  const published = Date.parse(asOf)
  if (!Number.isFinite(published)) return true
  const ageMs = Date.now() - published
  return ageMs > expiresAfterDays * 24 * 60 * 60_000
}

function emptyCache(
  parseStatus: NetworkDatasetHealth['parseStatus'],
): NetworkListCache {
  return {
    asOf: '',
    source: '',
    loadedAt: new Date().toISOString(),
    expiresAfterDays: DEFAULT_EXPIRY_DAYS,
    expired: true,
    parseStatus,
    proxyCidrs: [],
    hostingAsns: new Set(),
    hostingOrgPatterns: [],
    addressFamilies: [],
  }
}

function loadList(force = false): NetworkListCache {
  if (listCache && !force) return listCache
  let next: NetworkListCache | null = null
  for (const path of candidateListPaths()) {
    if (!existsSync(path)) continue
    try {
      const parsed = JSON.parse(readFileSync(path, 'utf8')) as NetworkListFile
      const expiresAfterDays =
        typeof parsed.expiresAfterDays === 'number' &&
        Number.isFinite(parsed.expiresAfterDays)
          ? parsed.expiresAfterDays
          : DEFAULT_EXPIRY_DAYS
      const asOf = String(parsed.asOf || '').trim()
      const expired = isExpired(asOf, expiresAfterDays)
      const v4 = (parsed.proxyCidrs ?? [])
        .map(parseCidr)
        .filter((c): c is ParsedCidr => Boolean(c))
      const v6 = (parsed.proxyCidrsV6 ?? [])
        .map(parseCidr)
        .filter((c): c is ParsedCidr => Boolean(c))
      const proxyCidrs = [...v4, ...v6]
      const hostingAsns = new Set(
        (parsed.hostingAsns ?? []).filter((n) => Number.isFinite(n)),
      )
      const hostingOrgPatterns = (parsed.hostingOrgPatterns ?? [])
        .map((p) => p.trim().toLowerCase())
        .filter(Boolean)
      const addressFamilies: Array<'ipv4' | 'ipv6'> = []
      if (v4.length > 0 || hostingAsns.size > 0) addressFamilies.push('ipv4')
      if (v6.length > 0) addressFamilies.push('ipv6')
      const parseStatus: NetworkDatasetHealth['parseStatus'] = expired
        ? 'stale'
        : proxyCidrs.length === 0 &&
            hostingAsns.size === 0 &&
            hostingOrgPatterns.length === 0
          ? 'empty'
          : 'ok'
      next = {
        asOf,
        source: String(parsed.source || 'network-lists.json').trim(),
        loadedAt: new Date().toISOString(),
        expiresAfterDays,
        expired,
        parseStatus,
        proxyCidrs,
        hostingAsns,
        hostingOrgPatterns,
        addressFamilies,
      }
      break
    } catch {
      next = emptyCache('failed')
      break
    }
  }
  if (!next) next = emptyCache('missing')
  listCache = next
  return listCache
}

export function getNetworkDatasetFingerprint(): string {
  const list = loadList()
  return [
    list.asOf || 'none',
    list.parseStatus,
    list.expired ? 'expired' : 'fresh',
    list.source || 'unknown',
  ].join(':')
}

async function ensureAsnReader(): Promise<Reader<AsnResponse> | null> {
  if (asnInitTried) return asnReader
  asnInitTried = true
  for (const dbPath of candidateAsnPaths()) {
    if (!existsSync(dbPath)) continue
    try {
      asnReader = await maxmind.open<AsnResponse>(dbPath)
      asnDbStatus = 'ok'
      return asnReader
    } catch {
      asnDbStatus = 'failed'
    }
  }
  asnReader = null
  if (asnDbStatus !== 'failed') asnDbStatus = 'missing'
  return null
}

function ipInProxyList(ip: string, cidrs: ParsedCidr[]): boolean {
  if (ip.includes(':')) {
    const value = ipv6ToBigInt(ip)
    if (value == null) return false
    for (const cidr of cidrs) {
      if (cidr.version !== 6) continue
      const shift = BigInt(128 - cidr.maskBits)
      if (cidr.maskBits === 0) return true
      if (value >> shift === cidr.network >> shift) return true
    }
    return false
  }
  const value = ipv4ToInt(ip)
  if (value == null) return false
  for (const cidr of cidrs) {
    if (cidr.version !== 4) continue
    if ((value & cidr.mask) >>> 0 === cidr.network) return true
  }
  return false
}

function isPrivateOrLocal(ip: string): boolean {
  return (
    ip === '127.0.0.1' ||
    ip === '::1' ||
    ip.startsWith('192.168.') ||
    ip.startsWith('10.') ||
    /^172\.(1[6-9]|2\d|3[0-1])\./.test(ip) ||
    ip.startsWith('fc') ||
    ip.startsWith('fd') ||
    ip.startsWith('fe80:')
  )
}

export function getNetworkDatasetHealth(): NetworkDatasetHealth {
  const list = loadList()
  const proxyListStatus: NetworkDatasetHealth['proxyListStatus'] =
    list.parseStatus === 'failed' || list.parseStatus === 'missing'
      ? list.parseStatus
      : list.expired
        ? 'stale'
        : list.proxyCidrs.length === 0
          ? 'empty'
          : 'ok'
  const hostingAsnStatus: NetworkDatasetHealth['hostingAsnStatus'] =
    list.parseStatus === 'failed' || list.parseStatus === 'missing'
      ? list.parseStatus
      : list.expired
        ? 'stale'
        : list.hostingAsns.size === 0 && list.hostingOrgPatterns.length === 0
          ? 'empty'
          : 'ok'

  return {
    source: list.source,
    publicationDate: list.asOf,
    loadTime: list.loadedAt,
    expiryPolicyDays: list.expiresAfterDays,
    expired: list.expired,
    supportedAddressFamilies:
      list.addressFamilies.length > 0
        ? list.addressFamilies
        : (['ipv4', 'ipv6'] as Array<'ipv4' | 'ipv6'>),
    parseStatus: list.parseStatus,
    proxyListStatus,
    hostingAsnStatus,
    asnDbStatus,
    proxyCidrCount: list.proxyCidrs.length,
    hostingAsnCount: list.hostingAsns.size,
  }
}

export function reloadNetworkLists(): NetworkDatasetHealth {
  listCache = null
  return getNetworkDatasetHealth()
}

export async function classifyNetwork(ip: string): Promise<NetworkClassification> {
  const normalized = ip.startsWith('::ffff:') ? ip.slice(7) : ip.trim()
  if (!normalized || isPrivateOrLocal(normalized)) {
    return {
      ...UNAVAILABLE,
      detail: 'Client IP missing or private; network classification unavailable',
    }
  }

  const list = loadList()
  const reader = await ensureAsnReader()
  const health = getNetworkDatasetHealth()

  if (list.expired) {
    return {
      ...UNAVAILABLE,
      evidenceSource: list.source,
      evidenceAsOf: list.asOf,
      detail: `Network list expired (as of ${list.asOf || 'unknown'}); classification unavailable`,
    }
  }

  const proxyUsable = health.proxyListStatus === 'ok'
  const hostingUsable = health.hostingAsnStatus === 'ok'
  const asnUsable = Boolean(reader) && health.asnDbStatus === 'ok'

  if (!proxyUsable && !hostingUsable && !asnUsable) {
    return {
      ...UNAVAILABLE,
      detail:
        'No ASN database or usable network list loaded; classification unavailable',
    }
  }

  const evidenceSource = [
    list.source || null,
    asnUsable ? 'asn-mmdb' : null,
  ]
    .filter(Boolean)
    .join('+')
  const evidenceAsOf = list.asOf || ''

  if (proxyUsable && ipInProxyList(normalized, list.proxyCidrs)) {
    return {
      networkClass: 'known_proxy_list',
      asn: null,
      org: '',
      evidenceSource,
      evidenceAsOf,
      detail: `IP matched proxy/VPN list (${list.source || 'network-lists'}; as of ${list.asOf || 'unknown'})`,
    }
  }

  let asn: number | null = null
  let org = ''
  if (asnUsable && reader) {
    try {
      const result = reader.get(normalized)
      asn =
        typeof result?.autonomous_system_number === 'number'
          ? result.autonomous_system_number
          : null
      org = result?.autonomous_system_organization?.trim() || ''
    } catch {
      /* ignore */
    }
  }

  if (hostingUsable) {
    const orgLower = org.toLowerCase()
    const hostingByAsn = asn != null && list.hostingAsns.has(asn)
    const hostingByOrg =
      orgLower.length > 0 &&
      list.hostingOrgPatterns.some((p) => orgLower.includes(p))
    if (hostingByAsn || hostingByOrg) {
      return {
        networkClass: 'hosting_network',
        asn,
        org,
        evidenceSource,
        evidenceAsOf,
        detail:
          'Hosting/infrastructure network match — suggests data-centre use, not necessarily a proxy/VPN',
      }
    }
  }

  if (!asnUsable && !proxyUsable) {
    return {
      ...UNAVAILABLE,
      evidenceSource,
      evidenceAsOf,
      detail: 'Insufficient network evidence to classify',
    }
  }

  if (!proxyUsable && asnUsable && !hostingUsable) {
    return {
      networkClass: 'no_known_match',
      asn,
      org,
      evidenceSource,
      evidenceAsOf,
      detail:
        'ASN looked up; proxy list empty/unavailable so absence of proxy match is not evidence of no proxy',
    }
  }

  return {
    networkClass: 'no_known_match',
    asn,
    org,
    evidenceSource,
    evidenceAsOf,
    detail:
      'No known proxy/VPN or hosting list match — does not mean the connection is not proxied',
  }
}

export function classifyNetworkSync(ip: string): NetworkClassification {
  const normalized = ip.startsWith('::ffff:') ? ip.slice(7) : ip.trim()
  if (!normalized || isPrivateOrLocal(normalized)) {
    return {
      ...UNAVAILABLE,
      detail: 'Client IP missing or private; network classification unavailable',
    }
  }
  const list = loadList()
  if (list.expired) {
    return {
      ...UNAVAILABLE,
      evidenceSource: list.source,
      evidenceAsOf: list.asOf,
      detail: `Network list expired (as of ${list.asOf || 'unknown'}); classification unavailable`,
    }
  }
  const evidenceSource = list.source || 'network-lists.json'
  const evidenceAsOf = list.asOf || ''
  const proxyUsable = list.proxyCidrs.length > 0

  if (proxyUsable && ipInProxyList(normalized, list.proxyCidrs)) {
    return {
      networkClass: 'known_proxy_list',
      asn: null,
      org: '',
      evidenceSource,
      evidenceAsOf,
      detail: `IP matched proxy/VPN list (${evidenceSource}; as of ${evidenceAsOf || 'unknown'})`,
    }
  }

  if (asnReader) {
    try {
      const result = asnReader.get(normalized)
      const asn =
        typeof result?.autonomous_system_number === 'number'
          ? result.autonomous_system_number
          : null
      const org = result?.autonomous_system_organization?.trim() || ''
      const orgLower = org.toLowerCase()
      if (
        (asn != null && list.hostingAsns.has(asn)) ||
        list.hostingOrgPatterns.some((p) => orgLower.includes(p))
      ) {
        return {
          networkClass: 'hosting_network',
          asn,
          org,
          evidenceSource: `${evidenceSource}+asn-mmdb`,
          evidenceAsOf,
          detail:
            'Hosting/infrastructure network match — suggests data-centre use, not necessarily a proxy/VPN',
        }
      }
      return {
        networkClass: 'no_known_match',
        asn,
        org,
        evidenceSource: `${evidenceSource}+asn-mmdb`,
        evidenceAsOf,
        detail:
          'No known proxy/VPN or hosting list match — does not mean the connection is not proxied',
      }
    } catch {
      /* fall through */
    }
  }

  if (list.proxyCidrs.length === 0 && list.hostingAsns.size === 0) {
    return {
      ...UNAVAILABLE,
      evidenceSource,
      evidenceAsOf,
      detail:
        'No ASN database or network list loaded; classification unavailable',
    }
  }

  return {
    networkClass: 'no_known_match',
    asn: null,
    org: '',
    evidenceSource,
    evidenceAsOf,
    detail:
      'No known proxy/VPN list match (ASN unavailable) — does not mean the connection is not proxied',
  }
}

export async function initNetworkClassify(logger?: {
  info: (obj: unknown, msg?: string) => void
  warn: (obj: unknown, msg?: string) => void
}): Promise<void> {
  loadList()
  const reader = await ensureAsnReader()
  const health = getNetworkDatasetHealth()
  logger?.info(
    {
      ...health,
      asnLoaded: Boolean(reader),
    },
    'network classification ready',
  )
  if (health.expired || health.parseStatus === 'missing') {
    logger?.warn(
      health,
      'network classification limited: load GEOIP_ASN_DB_PATH and/or apps/api/data/network-lists.json',
    )
  }
}

export const __networkClassifyTest = {
  parseCidr,
  ipv4ToInt,
  ipv6ToBigInt,
  ipInProxyList,
  isExpired,
  loadList,
  resetCache: () => {
    listCache = null
    asnReader = null
    asnInitTried = false
    asnDbStatus = 'missing'
  },
}
