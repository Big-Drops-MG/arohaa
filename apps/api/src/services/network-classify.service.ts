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
type Ipv4Range = { start: number; end: number }

type NetworkListCache = {
  asOf: string
  source: string
  loadedAt: string
  expiresAfterDays: number
  proxyExpired: boolean
  expired: boolean
  parseStatus: NetworkDatasetHealth['parseStatus']
  proxyCidrs: ParsedCidr[]
  proxyV4Ranges: Ipv4Range[]
  proxyV6Cidrs: ParsedCidrV6[]
  hostingAsns: Set<number>
  hostingOrgPatterns: string[]
  addressFamilies: Array<'ipv4' | 'ipv6'>
}

const DEFAULT_EXPIRY_DAYS = 14

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

function apiRootDir(): string {
  return fileURLToPath(new URL('../..', import.meta.url))
}

function candidateSeedPaths(): string[] {
  const configured = process.env.AROHAA_NETWORK_LIST_PATH?.trim()
  if (configured) return [configured]
  const cwd = process.cwd()
  return [
    resolve(apiRootDir(), 'data/network-lists.json'),
    resolve(cwd, 'apps/api/data/network-lists.json'),
    resolve(cwd, 'data/network-lists.json'),
  ]
}

function candidateSyncedPaths(): string[] {
  const configured = process.env.AROHAA_NETWORK_LIST_SYNCED_PATH?.trim()
  if (configured) return [configured]
  const cwd = process.cwd()
  return [
    resolve(apiRootDir(), 'data/network-lists.synced.json'),
    resolve(cwd, 'apps/api/data/network-lists.synced.json'),
    resolve(cwd, 'data/network-lists.synced.json'),
  ]
}

function candidateAsnPaths(): string[] {
  const configured = process.env.GEOIP_ASN_DB_PATH?.trim()
  if (configured) return [configured]
  const cwd = process.cwd()
  return [
    resolve(cwd, 'geoip', 'dbip-asn-lite.mmdb'),
    resolve(apiRootDir(), 'geoip', 'dbip-asn-lite.mmdb'),
    resolve(cwd, 'apps', 'api', 'geoip', 'dbip-asn-lite.mmdb'),
  ]
}

function readJsonFile(path: string): NetworkListFile | null {
  if (!existsSync(path)) return null
  try {
    return JSON.parse(readFileSync(path, 'utf8')) as NetworkListFile
  } catch {
    return null
  }
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
    const tail =
      sides.length === 2 && sides[1] ? sides[1].split(':').filter(Boolean) : []
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

function cidrToIpv4Range(cidr: ParsedCidrV4): Ipv4Range {
  const start = cidr.network >>> 0
  const end = (cidr.network | (~cidr.mask >>> 0)) >>> 0
  return { start, end }
}

function mergeIpv4Ranges(ranges: Ipv4Range[]): Ipv4Range[] {
  if (ranges.length === 0) return []
  const sorted = [...ranges].sort((a, b) => a.start - b.start || a.end - b.end)
  const out: Ipv4Range[] = [{ ...sorted[0]! }]
  for (let i = 1; i < sorted.length; i++) {
    const cur = sorted[i]!
    const last = out[out.length - 1]!
    if (cur.start <= (last.end + 1) >>> 0 || cur.start <= last.end) {
      last.end = Math.max(last.end, cur.end) >>> 0
    } else {
      out.push({ ...cur })
    }
  }
  return out
}

function ipv4InRanges(value: number, ranges: Ipv4Range[]): boolean {
  let lo = 0
  let hi = ranges.length - 1
  while (lo <= hi) {
    const mid = (lo + hi) >> 1
    const range = ranges[mid]!
    if (value < range.start) hi = mid - 1
    else if (value > range.end) lo = mid + 1
    else return true
  }
  return false
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
    proxyExpired: true,
    expired: true,
    parseStatus,
    proxyCidrs: [],
    proxyV4Ranges: [],
    proxyV6Cidrs: [],
    hostingAsns: new Set(),
    hostingOrgPatterns: [],
    addressFamilies: [],
  }
}

function buildCacheFromFiles(
  seed: NetworkListFile | null,
  synced: NetworkListFile | null,
): NetworkListCache {
  if (!seed && !synced) return emptyCache('missing')

  const expiresAfterDays =
    typeof synced?.expiresAfterDays === 'number' &&
    Number.isFinite(synced.expiresAfterDays)
      ? synced.expiresAfterDays
      : typeof seed?.expiresAfterDays === 'number' &&
          Number.isFinite(seed.expiresAfterDays)
        ? seed.expiresAfterDays
        : DEFAULT_EXPIRY_DAYS

  const asOf = String(synced?.asOf || seed?.asOf || '').trim()
  const proxyExpired = isExpired(asOf, expiresAfterDays)

  const proxyRaw = [
    ...(synced?.proxyCidrs ?? seed?.proxyCidrs ?? []),
    ...(synced?.proxyCidrsV6 ?? seed?.proxyCidrsV6 ?? []),
  ]
  const parsedProxy = proxyRaw
    .map(parseCidr)
    .filter((c): c is ParsedCidr => Boolean(c))
  const proxyV4 = parsedProxy.filter(
    (c): c is ParsedCidrV4 => c.version === 4,
  )
  const proxyV6Cidrs = parsedProxy.filter(
    (c): c is ParsedCidrV6 => c.version === 6,
  )
  const proxyV4Ranges = mergeIpv4Ranges(proxyV4.map(cidrToIpv4Range))

  const hostingAsns = new Set(
    [...(seed?.hostingAsns ?? []), ...(synced?.hostingAsns ?? [])].filter((n) =>
      Number.isFinite(n),
    ),
  )
  const hostingOrgPatterns = [
    ...new Set(
      [...(seed?.hostingOrgPatterns ?? []), ...(synced?.hostingOrgPatterns ?? [])]
        .map((p) => p.trim().toLowerCase())
        .filter(Boolean),
    ),
  ]

  const addressFamilies: Array<'ipv4' | 'ipv6'> = []
  if (proxyV4.length > 0 || hostingAsns.size > 0) addressFamilies.push('ipv4')
  if (proxyV6Cidrs.length > 0) addressFamilies.push('ipv6')

  const hasAnything =
    parsedProxy.length > 0 ||
    hostingAsns.size > 0 ||
    hostingOrgPatterns.length > 0

  const parseStatus: NetworkDatasetHealth['parseStatus'] = !hasAnything
    ? 'empty'
    : proxyExpired && parsedProxy.length > 0
      ? 'stale'
      : 'ok'

  const sourceParts = [
    synced?.source ? String(synced.source).trim() : null,
    seed?.source ? String(seed.source).trim() : null,
  ].filter(Boolean)

  return {
    asOf,
    source: sourceParts.join('+') || 'network-lists',
    loadedAt: new Date().toISOString(),
    expiresAfterDays,
    proxyExpired,
    expired: proxyExpired && parsedProxy.length > 0,
    parseStatus,
    proxyCidrs: parsedProxy,
    proxyV4Ranges,
    proxyV6Cidrs,
    hostingAsns,
    hostingOrgPatterns,
    addressFamilies,
  }
}

function loadList(force = false): NetworkListCache {
  if (listCache && !force) return listCache

  let seed: NetworkListFile | null = null
  let seedFailed = false
  for (const path of candidateSeedPaths()) {
    if (!existsSync(path)) continue
    const parsed = readJsonFile(path)
    if (!parsed) {
      seedFailed = true
      continue
    }
    seed = parsed
    break
  }

  let synced: NetworkListFile | null = null
  for (const path of candidateSyncedPaths()) {
    if (!existsSync(path)) continue
    const parsed = readJsonFile(path)
    if (!parsed) continue
    synced = parsed
    break
  }

  if (!seed && !synced) {
    listCache = emptyCache(seedFailed ? 'failed' : 'missing')
    return listCache
  }

  listCache = buildCacheFromFiles(seed, synced)
  return listCache
}

export function getNetworkDatasetFingerprint(): string {
  const list = loadList()
  return [
    list.asOf || 'none',
    list.parseStatus,
    list.proxyExpired ? 'proxy_expired' : 'fresh',
    list.source || 'unknown',
    String(list.proxyCidrs.length),
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

function ipInProxyList(
  ip: string,
  cidrs: ParsedCidr[],
  ranges?: Ipv4Range[],
  v6Cidrs?: ParsedCidrV6[],
): boolean {
  if (ip.includes(':')) {
    const value = ipv6ToBigInt(ip)
    if (value == null) return false
    const list = v6Cidrs ?? cidrs.filter((c): c is ParsedCidrV6 => c.version === 6)
    for (const cidr of list) {
      const shift = BigInt(128 - cidr.maskBits)
      if (cidr.maskBits === 0) return true
      if (value >> shift === cidr.network >> shift) return true
    }
    return false
  }

  const value = ipv4ToInt(ip)
  if (value == null) return false
  if (ranges && ranges.length > 0) return ipv4InRanges(value, ranges)
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
      : list.proxyCidrs.length === 0
        ? 'empty'
        : list.proxyExpired
          ? 'stale'
          : 'ok'

  const hostingAsnStatus: NetworkDatasetHealth['hostingAsnStatus'] =
    list.parseStatus === 'failed' || list.parseStatus === 'missing'
      ? list.parseStatus
      : list.hostingAsns.size === 0 && list.hostingOrgPatterns.length === 0
        ? 'empty'
        : 'ok'

  return {
    source: list.source,
    publicationDate: list.asOf,
    loadTime: list.loadedAt,
    expiryPolicyDays: list.expiresAfterDays,
    expired: list.proxyExpired && list.proxyCidrs.length > 0,
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

function matchProxy(list: NetworkListCache, ip: string): boolean {
  if (list.proxyCidrs.length === 0 || list.proxyExpired) return false
  return ipInProxyList(
    ip,
    list.proxyCidrs,
    list.proxyV4Ranges,
    list.proxyV6Cidrs,
  )
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

  const proxyUsable = health.proxyListStatus === 'ok'
  const hostingUsable = health.hostingAsnStatus === 'ok'
  const asnUsable = Boolean(reader) && health.asnDbStatus === 'ok'

  if (!proxyUsable && !hostingUsable && !asnUsable) {
    return {
      ...UNAVAILABLE,
      evidenceSource: list.source,
      evidenceAsOf: list.asOf,
      detail:
        list.proxyExpired && list.proxyCidrs.length > 0
          ? `Network proxy list expired (as of ${list.asOf || 'unknown'}); ASN/hosting also unavailable`
          : 'No ASN database or usable network list loaded; classification unavailable',
    }
  }

  const evidenceSource = [list.source || null, asnUsable ? 'asn-mmdb' : null]
    .filter(Boolean)
    .join('+')
  const evidenceAsOf = list.asOf || ''

  if (proxyUsable && matchProxy(list, normalized)) {
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
  const evidenceSource = list.source || 'network-lists.json'
  const evidenceAsOf = list.asOf || ''
  const proxyUsable = list.proxyCidrs.length > 0 && !list.proxyExpired
  const hostingUsable =
    list.hostingAsns.size > 0 || list.hostingOrgPatterns.length > 0

  if (proxyUsable && matchProxy(list, normalized)) {
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
        hostingUsable &&
        ((asn != null && list.hostingAsns.has(asn)) ||
          list.hostingOrgPatterns.some((p) => orgLower.includes(p)))
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

  if (!proxyUsable && !hostingUsable) {
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
  if (
    health.proxyListStatus === 'empty' ||
    health.proxyListStatus === 'stale' ||
    health.parseStatus === 'missing'
  ) {
    logger?.warn(
      health,
      'network classification limited: run network list sync and/or load GEOIP_ASN_DB_PATH',
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
  mergeIpv4Ranges,
  ipv4InRanges,
  resetCache: () => {
    listCache = null
    asnReader = null
    asnInitTried = false
    asnDbStatus = 'missing'
  },
}
