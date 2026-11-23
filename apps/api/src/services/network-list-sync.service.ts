import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { CLICKHOUSE_EVENTS_TABLE } from '../lib/clickhouse-events-table.js'
import {
  getClickHouseClient,
  LEAD_RISK_TABLE,
  shouldSkipClickHouse,
} from './clickhouse.service.js'
import { reloadNetworkLists } from './network-classify.service.js'

const DEFAULT_EXPIRY_DAYS = 14
const FETCH_TIMEOUT_MS = 45_000
const MAX_PROXY_CIDRS = 100_000
const INTERNAL_LOOKBACK_DAYS = 90
const INTERNAL_MAX_IPS = 8_000
const INTERNAL_SUBNET_MIN_HITS = 3

const SEED_HOSTING_ASNS = [
  16509, 14618, 15169, 396982, 8075, 13335, 14061, 20473, 16276, 24940, 63949,
  62567, 31898, 45102, 36351, 209242,
]

const SEED_HOSTING_ORG_PATTERNS = [
  'amazon',
  'aws',
  'google cloud',
  'google llc',
  'microsoft',
  'azure',
  'digitalocean',
  'linode',
  'akamai',
  'ovh',
  'hetzner',
  'vultr',
  'cloudflare',
  'oracle cloud',
  'alibaba',
]

type NetworkListFile = {
  asOf?: string
  source?: string
  expiresAfterDays?: number
  proxyCidrs?: string[]
  proxyCidrsV6?: string[]
  hostingAsns?: number[]
  hostingOrgPatterns?: string[]
  syncMeta?: Record<string, unknown>
}

export type NetworkListSyncSourceResult = {
  id: string
  ok: boolean
  count: number
  error?: string
}

export type NetworkListSyncResult = {
  ok: boolean
  asOf: string
  proxyCidrCount: number
  proxyCidrV6Count: number
  internalBadIpCount: number
  internalBadSubnetCount: number
  path: string
  sources: NetworkListSyncSourceResult[]
  reloaded: boolean
}

type FreeSource = {
  id: string
  url: string
  kind: 'cidr' | 'ip'
  family: 'ipv4' | 'ipv6' | 'auto'
  /** Soft per-source cap before merge (keeps high-signal lists complete). */
  maxCidrs?: number
}

const FREE_SOURCES: FreeSource[] = [
  {
    id: 'tor-exits',
    url: 'https://check.torproject.org/torbulkexitlist',
    kind: 'ip',
    family: 'auto',
  },
  {
    id: 'firehol-proxies',
    url: 'https://raw.githubusercontent.com/firehol/blocklist-ipsets/master/firehol_proxies.netset',
    kind: 'cidr',
    family: 'ipv4',
    maxCidrs: 40_000,
  },
  {
    id: 'x4bnet-datacenter',
    url: 'https://raw.githubusercontent.com/X4BNet/lists_vpn/main/output/datacenter/ipv4.txt',
    kind: 'cidr',
    family: 'ipv4',
    maxCidrs: 50_000,
  },
  {
    id: 'x4bnet-vpn',
    url: 'https://raw.githubusercontent.com/X4BNet/lists_vpn/main/output/vpn/ipv4.txt',
    kind: 'cidr',
    family: 'ipv4',
    maxCidrs: 20_000,
  },
]

function apiDataDir(): string {
  const apiRoot = fileURLToPath(new URL('../..', import.meta.url))
  return resolve(apiRoot, 'data')
}

export function resolveSeedListPath(): string {
  const configured = process.env.AROHAA_NETWORK_LIST_PATH?.trim()
  if (configured) return configured
  return resolve(apiDataDir(), 'network-lists.json')
}

export function resolveSyncedListPath(): string {
  const configured = process.env.AROHAA_NETWORK_LIST_SYNCED_PATH?.trim()
  if (configured) return configured
  return resolve(apiDataDir(), 'network-lists.synced.json')
}

function todayUtc(): string {
  return new Date().toISOString().slice(0, 10)
}

function isIpv4(value: string): boolean {
  const parts = value.split('.')
  if (parts.length !== 4) return false
  return parts.every((part) => {
    const n = Number(part)
    return Number.isInteger(n) && n >= 0 && n <= 255
  })
}

function isIpv6(value: string): boolean {
  return value.includes(':')
}

function normalizeCidrLine(raw: string, kind: 'cidr' | 'ip'): string | null {
  const line = raw.trim()
  if (!line || line.startsWith('#') || line.startsWith(';')) return null
  const token = line.split(/\s+/)[0]?.trim() || ''
  if (!token) return null
  if (kind === 'ip') {
    if (isIpv4(token)) return `${token}/32`
    if (isIpv6(token)) return `${token}/128`
    return null
  }
  if (token.includes('/')) {
    const [ip, prefix] = token.split('/')
    if (!ip || !prefix) return null
    if (isIpv4(ip) || isIpv6(ip)) return token.toLowerCase()
    return null
  }
  if (isIpv4(token)) return `${token}/32`
  if (isIpv6(token)) return `${token}/128`
  return null
}

function splitFamily(cidrs: Iterable<string>): {
  v4: string[]
  v6: string[]
} {
  const v4: string[] = []
  const v6: string[] = []
  for (const cidr of cidrs) {
    const ip = cidr.split('/')[0] || ''
    if (isIpv6(ip)) v6.push(cidr)
    else if (isIpv4(ip)) v4.push(cidr)
  }
  return { v4, v6 }
}

async function fetchSource(
  source: FreeSource,
): Promise<{ id: string; cidrs: string[]; error?: string }> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS)
  try {
    const res = await fetch(source.url, {
      signal: controller.signal,
      headers: { accept: 'text/plain,*/*' },
    })
    if (!res.ok) {
      return { id: source.id, cidrs: [], error: `HTTP ${res.status}` }
    }
    const text = await res.text()
    const cidrs: string[] = []
    const max = source.maxCidrs ?? Number.POSITIVE_INFINITY
    for (const line of text.split(/\r?\n/)) {
      const cidr = normalizeCidrLine(line, source.kind)
      if (!cidr) continue
      const ip = cidr.split('/')[0] || ''
      if (source.family === 'ipv4' && !isIpv4(ip)) continue
      if (source.family === 'ipv6' && !isIpv6(ip)) continue
      cidrs.push(cidr)
      if (cidrs.length >= max) break
    }
    return { id: source.id, cidrs }
  } catch (err) {
    return {
      id: source.id,
      cidrs: [],
      error: err instanceof Error ? err.message : String(err),
    }
  } finally {
    clearTimeout(timer)
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

function intToIpv4(n: number): string {
  return [
    (n >>> 24) & 255,
    (n >>> 16) & 255,
    (n >>> 8) & 255,
    n & 255,
  ].join('.')
}

export function ipv4ToSlash24(ip: string): string | null {
  const n = ipv4ToInt(ip)
  if (n == null) return null
  return `${intToIpv4(n & 0xffffff00)}/24`
}

export function aggregateInternalBadCidrs(
  ips: string[],
  options?: { subnetMinHits?: number; maxIps?: number },
): { hostCidrs: string[]; subnetCidrs: string[] } {
  const subnetMinHits = options?.subnetMinHits ?? INTERNAL_SUBNET_MIN_HITS
  const maxIps = options?.maxIps ?? INTERNAL_MAX_IPS
  const unique = new Set<string>()
  for (const raw of ips) {
    const ip = raw.trim()
    if (!isIpv4(ip) && !isIpv6(ip)) continue
    if (
      ip === '127.0.0.1' ||
      ip === '::1' ||
      ip.startsWith('10.') ||
      ip.startsWith('192.168.') ||
      /^172\.(1[6-9]|2\d|3[0-1])\./.test(ip)
    ) {
      continue
    }
    unique.add(ip)
    if (unique.size >= maxIps) break
  }

  const hostCidrs: string[] = []
  const subnetCounts = new Map<string, number>()
  for (const ip of unique) {
    if (isIpv4(ip)) {
      hostCidrs.push(`${ip}/32`)
      const subnet = ipv4ToSlash24(ip)
      if (subnet) {
        subnetCounts.set(subnet, (subnetCounts.get(subnet) || 0) + 1)
      }
    } else {
      hostCidrs.push(`${ip}/128`)
    }
  }

  const subnetCidrs: string[] = []
  for (const [subnet, count] of subnetCounts) {
    if (count >= subnetMinHits) subnetCidrs.push(subnet)
  }
  return { hostCidrs, subnetCidrs }
}

async function loadInternalBadIps(): Promise<{
  ips: string[]
  error?: string
}> {
  if (shouldSkipClickHouse()) {
    return { ips: [], error: 'clickhouse backoff' }
  }
  if (!process.env.CLICKHOUSE_URL?.trim()) {
    return { ips: [], error: 'CLICKHOUSE_URL missing' }
  }

  try {
    const ch = getClickHouseClient()
    const result = await ch.query({
      format: 'JSON',
      query: `
        SELECT
          trimBoth(e.client_ip) AS client_ip
        FROM ${LEAD_RISK_TABLE} AS r FINAL
        INNER JOIN (
          SELECT
            workspace_id,
            session_id,
            anyIf(client_ip, client_ip != '') AS client_ip
          FROM ${CLICKHOUSE_EVENTS_TABLE}
          WHERE client_ip != ''
            AND created_at >= now64(3) - INTERVAL {days:UInt32} DAY
          GROUP BY workspace_id, session_id
        ) AS e
          ON e.workspace_id = r.workspace_id
         AND e.session_id = r.session_id
        WHERE r.scored_at >= now64(3) - INTERVAL {days:UInt32} DAY
          AND e.client_ip != ''
          AND (
            r.override_label = 'fraud'
            OR (
              if(r.override_label IN ('fraud', 'legit'), r.override_label, r.label) = 'fraud'
              AND r.score <= 35
            )
          )
        LIMIT {limit:UInt32}
      `,
      query_params: {
        days: INTERNAL_LOOKBACK_DAYS,
        limit: INTERNAL_MAX_IPS,
      },
    })
    const json = (await result.json()) as { data: Array<{ client_ip: string }> }
    return {
      ips: (json.data || [])
        .map((row) => String(row.client_ip || '').trim())
        .filter(Boolean),
    }
  } catch (err) {
    return {
      ips: [],
      error: err instanceof Error ? err.message : String(err),
    }
  }
}

function readSeedFile(path: string): NetworkListFile {
  if (!existsSync(path)) {
    return {
      hostingAsns: [...SEED_HOSTING_ASNS],
      hostingOrgPatterns: [...SEED_HOSTING_ORG_PATTERNS],
      proxyCidrs: [],
      proxyCidrsV6: [],
      expiresAfterDays: DEFAULT_EXPIRY_DAYS,
    }
  }
  try {
    return JSON.parse(readFileSync(path, 'utf8')) as NetworkListFile
  } catch {
    return {
      hostingAsns: [...SEED_HOSTING_ASNS],
      hostingOrgPatterns: [...SEED_HOSTING_ORG_PATTERNS],
      proxyCidrs: [],
      proxyCidrsV6: [],
      expiresAfterDays: DEFAULT_EXPIRY_DAYS,
    }
  }
}

function capCidrs(cidrs: string[], max: number): string[] {
  if (cidrs.length <= max) return cidrs
  return cidrs.slice(0, max)
}

export async function syncNetworkLists(options?: {
  skipInternal?: boolean
  skipReload?: boolean
}): Promise<NetworkListSyncResult> {
  const seedPath = resolveSeedListPath()
  const syncedPath = resolveSyncedListPath()
  const seed = readSeedFile(seedPath)
  const asOf = todayUtc()
  const sources: NetworkListSyncSourceResult[] = []
  const allV4 = new Set<string>()
  const allV6 = new Set<string>()

  const fetched = await Promise.all(FREE_SOURCES.map((source) => fetchSource(source)))
  for (const item of fetched) {
    const { v4, v6 } = splitFamily(item.cidrs)
    for (const cidr of v4) allV4.add(cidr)
    for (const cidr of v6) allV6.add(cidr)
    sources.push({
      id: item.id,
      ok: !item.error,
      count: item.cidrs.length,
      ...(item.error ? { error: item.error } : {}),
    })
  }

  let internalBadIpCount = 0
  let internalBadSubnetCount = 0
  if (!options?.skipInternal) {
    const internal = await loadInternalBadIps()
    const aggregated = aggregateInternalBadCidrs(internal.ips)
    for (const cidr of aggregated.hostCidrs) {
      const ip = cidr.split('/')[0] || ''
      if (isIpv6(ip)) allV6.add(cidr)
      else allV4.add(cidr)
    }
    for (const cidr of aggregated.subnetCidrs) allV4.add(cidr)
    internalBadIpCount = aggregated.hostCidrs.length
    internalBadSubnetCount = aggregated.subnetCidrs.length
    sources.push({
      id: 'internal-bad-ips',
      ok: !internal.error,
      count: aggregated.hostCidrs.length + aggregated.subnetCidrs.length,
      ...(internal.error ? { error: internal.error } : {}),
    })
  }

  const proxyCidrs = capCidrs([...allV4].sort(), MAX_PROXY_CIDRS)
  const proxyCidrsV6 = capCidrs([...allV6].sort(), Math.floor(MAX_PROXY_CIDRS / 4))

  const hostingAsns = [
    ...new Set(
      [
        ...(seed.hostingAsns || []),
        ...SEED_HOSTING_ASNS,
      ].filter((n) => Number.isFinite(n)),
    ),
  ].sort((a, b) => a - b)

  const hostingOrgPatterns = [
    ...new Set(
      [...(seed.hostingOrgPatterns || []), ...SEED_HOSTING_ORG_PATTERNS]
        .map((p) => p.trim().toLowerCase())
        .filter(Boolean),
    ),
  ].sort()

  const payload: NetworkListFile = {
    asOf,
    source: 'arohaa-free-sync+internal',
    expiresAfterDays: DEFAULT_EXPIRY_DAYS,
    proxyCidrs,
    proxyCidrsV6,
    hostingAsns,
    hostingOrgPatterns,
    syncMeta: {
      syncedAt: new Date().toISOString(),
      seedPath,
      sources,
      internalBadIpCount,
      internalBadSubnetCount,
      freeSourceCount: FREE_SOURCES.length,
    },
  }

  mkdirSync(dirname(syncedPath), { recursive: true })
  writeFileSync(syncedPath, `${JSON.stringify(payload, null, 2)}\n`, 'utf8')

  let reloaded = false
  if (!options?.skipReload) {
    reloadNetworkLists()
    reloaded = true
  }

  const ok =
    proxyCidrs.length > 0 ||
    proxyCidrsV6.length > 0 ||
    sources.some((s) => s.ok && s.count > 0)

  return {
    ok,
    asOf,
    proxyCidrCount: proxyCidrs.length,
    proxyCidrV6Count: proxyCidrsV6.length,
    internalBadIpCount,
    internalBadSubnetCount,
    path: syncedPath,
    sources,
    reloaded,
  }
}

export const __networkListSyncTest = {
  normalizeCidrLine,
  aggregateInternalBadCidrs,
  ipv4ToSlash24,
  FREE_SOURCES,
}
