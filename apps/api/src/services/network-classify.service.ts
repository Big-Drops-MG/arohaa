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

type NetworkListFile = {
  asOf?: string
  source?: string
  proxyCidrs?: string[]
  hostingAsns?: number[]
  hostingOrgPatterns?: string[]
}

type ParsedCidr = { network: number; mask: number }

type NetworkListCache = {
  asOf: string
  source: string
  proxyCidrs: ParsedCidr[]
  hostingAsns: Set<number>
  hostingOrgPatterns: string[]
}

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

function parseCidr(cidr: string): ParsedCidr | null {
  const [ip, bitsRaw] = cidr.trim().split('/')
  if (!ip || !bitsRaw) return null
  const bits = Number(bitsRaw)
  if (!Number.isInteger(bits) || bits < 0 || bits > 32) return null
  const base = ipv4ToInt(ip)
  if (base == null) return null
  const mask = bits === 0 ? 0 : (~0 << (32 - bits)) >>> 0
  return { network: (base & mask) >>> 0, mask }
}

function loadList(): NetworkListCache {
  if (listCache) return listCache
  for (const path of candidateListPaths()) {
    if (!existsSync(path)) continue
    try {
      const parsed = JSON.parse(readFileSync(path, 'utf8')) as NetworkListFile
      const proxyCidrs = (parsed.proxyCidrs ?? [])
        .map(parseCidr)
        .filter((c): c is ParsedCidr => Boolean(c))
      listCache = {
        asOf: String(parsed.asOf || '').trim(),
        source: String(parsed.source || 'network-lists.json').trim(),
        proxyCidrs,
        hostingAsns: new Set(
          (parsed.hostingAsns ?? []).filter((n) => Number.isFinite(n)),
        ),
        hostingOrgPatterns: (parsed.hostingOrgPatterns ?? [])
          .map((p) => p.trim().toLowerCase())
          .filter(Boolean),
      }
      return listCache
    } catch {
      /* try next */
    }
  }
  listCache = {
    asOf: '',
    source: '',
    proxyCidrs: [],
    hostingAsns: new Set(),
    hostingOrgPatterns: [],
  }
  return listCache
}

async function ensureAsnReader(): Promise<Reader<AsnResponse> | null> {
  if (asnInitTried) return asnReader
  asnInitTried = true
  for (const dbPath of candidateAsnPaths()) {
    if (!existsSync(dbPath)) continue
    try {
      asnReader = await maxmind.open<AsnResponse>(dbPath)
      return asnReader
    } catch {
      /* try next */
    }
  }
  asnReader = null
  return null
}

function ipInProxyList(ip: string, cidrs: ParsedCidr[]): boolean {
  const value = ipv4ToInt(ip)
  if (value == null) return false
  for (const cidr of cidrs) {
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
    /^172\.(1[6-9]|2\d|3[0-1])\./.test(ip)
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
  const hasList =
    list.proxyCidrs.length > 0 ||
    list.hostingAsns.size > 0 ||
    list.hostingOrgPatterns.length > 0
  const reader = await ensureAsnReader()

  if (!hasList && !reader) {
    return {
      ...UNAVAILABLE,
      detail:
        'No ASN database or network list loaded; classification unavailable',
    }
  }

  const evidenceSource = [
    list.source || null,
    reader ? 'asn-mmdb' : null,
  ]
    .filter(Boolean)
    .join('+')
  const evidenceAsOf = list.asOf || ''

  if (list.proxyCidrs.length > 0 && ipInProxyList(normalized, list.proxyCidrs)) {
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
  if (reader) {
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

  if (!reader && list.proxyCidrs.length === 0) {
    return {
      ...UNAVAILABLE,
      evidenceSource,
      evidenceAsOf,
      detail: 'Insufficient network evidence to classify',
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

  if (list.proxyCidrs.length > 0 && ipInProxyList(normalized, list.proxyCidrs)) {
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
  const list = loadList()
  logger?.info(
    {
      listSource: list.source,
      listAsOf: list.asOf,
      proxyCidrs: list.proxyCidrs.length,
      hostingAsns: list.hostingAsns.size,
      asnLoaded: Boolean(reader),
    },
    'network classification ready',
  )
  if (!reader && list.proxyCidrs.length === 0) {
    logger?.warn(
      {},
      'network classification limited: load GEOIP_ASN_DB_PATH and/or apps/api/data/network-lists.json',
    )
  }
}
