import type {
  DataExportDashboardData,
  DataExportLeadRow,
} from "@/features/data-export/model/data-export"
import { DATA_EXPORT_PAGE_SIZE } from "@/features/data-export/model/data-export"
import type { DashboardUtmFilter } from "@/features/dashboard/model/utm-attribution-filter"
import {
  normalizeDashboardUtmFilter,
  serializeUtmValueList,
} from "@/features/dashboard/model/utm-attribution-filter"
import type { DashboardCustomRange } from "@/features/traffic/model/traffic-range"
import { buildAnalyticsApiPath } from "@/lib/dashboard/analytics-query"

export const DATA_LAB_LEADS_SCAN_PAGE_SIZE = Math.max(DATA_EXPORT_PAGE_SIZE, 50)
export const DATA_LAB_LEADS_SCAN_MAX_PAGES = 40
export const DATA_LAB_LEADS_SCAN_INCREMENTAL_MAX_PAGES = 5
const CACHE_TTL_MS = 120_000
const MAX_CACHE_ENTRIES = 8

export type DataLabLeadsScanResult = {
  leads: DataExportLeadRow[]
  total: number
  pagesScanned: number
  fromCache: boolean
  lastPage: DataExportDashboardData | null
  addedCount: number
}

type CacheEntry = {
  leads: DataExportLeadRow[]
  total: number
  pagesScanned: number
  expiresAt: number
}

type ScanInput = {
  projectId: string
  rangeId: string
  customRange?: DashboardCustomRange | null
  utmFilter?: DashboardUtmFilter | null
  segmentId?: string | null
}

type ProgressPartial = {
  leads: DataExportLeadRow[]
  total: number
  pagesScanned: number
}

type InflightEntry = {
  promise: Promise<DataLabLeadsScanResult>
  listeners: Set<(partial: ProgressPartial) => void>
}

const scanCache = new Map<string, CacheEntry>()
const inflight = new Map<string, InflightEntry>()

export function buildDataLabLeadsScanCacheKey(input: ScanInput): string {
  const utm = normalizeDashboardUtmFilter(input.utmFilter)
  const source = serializeUtmValueList(utm?.utm_source) || ""
  const s1 = serializeUtmValueList(utm?.utm_s1) || ""
  const from = input.rangeId === "custom" ? (input.customRange?.from ?? "") : ""
  const to = input.rangeId === "custom" ? (input.customRange?.to ?? "") : ""
  return [
    input.projectId,
    input.rangeId,
    from,
    to,
    source,
    s1,
    input.segmentId ?? "",
  ].join("|")
}

export function leadScanIdentity(lead: DataExportLeadRow): string {
  const session = (lead.sessionId || "").trim()
  if (session) return `s:${session}`
  return `f:${lead.createdAt}|${lead.zip}|${lead.email}`
}

export function takeNewerLeadsUntilKnown(
  pageLeads: DataExportLeadRow[],
  knownIds: Set<string>
): { newer: DataExportLeadRow[]; hitKnown: boolean } {
  const newer: DataExportLeadRow[] = []
  for (const lead of pageLeads) {
    const id = leadScanIdentity(lead)
    if (knownIds.has(id)) {
      return { newer, hitKnown: true }
    }
    newer.push(lead)
  }
  return { newer, hitKnown: false }
}

function readCache(key: string): CacheEntry | null {
  const cached = scanCache.get(key)
  if (!cached) return null
  if (cached.expiresAt <= Date.now()) {
    scanCache.delete(key)
    return null
  }
  scanCache.delete(key)
  scanCache.set(key, cached)
  return cached
}

function writeCache(key: string, entry: Omit<CacheEntry, "expiresAt">): void {
  scanCache.delete(key)
  scanCache.set(key, { ...entry, expiresAt: Date.now() + CACHE_TTL_MS })
  while (scanCache.size > MAX_CACHE_ENTRIES) {
    const oldestKey = scanCache.keys().next().value
    if (!oldestKey) break
    scanCache.delete(oldestKey)
  }
}

function toResult(
  entry: Pick<CacheEntry, "leads" | "total" | "pagesScanned">,
  extras: {
    fromCache: boolean
    lastPage: DataExportDashboardData | null
    addedCount?: number
  }
): DataLabLeadsScanResult {
  return {
    leads: entry.leads,
    total: entry.total,
    pagesScanned: entry.pagesScanned,
    fromCache: extras.fromCache,
    lastPage: extras.lastPage,
    addedCount: extras.addedCount ?? 0,
  }
}

async function fetchPage(
  input: ScanInput,
  offset: number
): Promise<DataExportDashboardData | null> {
  const url = buildAnalyticsApiPath(
    `/api/landing-pages/${encodeURIComponent(input.projectId)}/data-export`,
    {
      rangeId: input.rangeId,
      customRange: input.customRange,
      utmFilter: input.utmFilter,
      segmentId: input.segmentId,
    }
  )
  const withPaging = new URL(url, window.location.origin)
  withPaging.searchParams.set("limit", String(DATA_LAB_LEADS_SCAN_PAGE_SIZE))
  withPaging.searchParams.set("offset", String(offset))
  const res = await fetch(withPaging.pathname + withPaging.search, {
    cache: "no-store",
  })
  if (!res.ok) return null
  return (await res.json()) as DataExportDashboardData
}

function emitProgress(
  listeners: Set<(partial: ProgressPartial) => void>,
  partial: ProgressPartial
): void {
  for (const listener of listeners) {
    listener(partial)
  }
}

async function runFullScan(
  input: ScanInput,
  key: string,
  listeners: Set<(partial: ProgressPartial) => void>
): Promise<DataLabLeadsScanResult> {
  const collected: DataExportLeadRow[] = []
  let offset = 0
  let total = 0
  let pages = 0
  let lastPage: DataExportDashboardData | null = null

  while (pages < DATA_LAB_LEADS_SCAN_MAX_PAGES) {
    const page = await fetchPage(input, offset)
    if (!page) break
    lastPage = page
    total = page.total
    pages += 1
    collected.push(...page.leads)
    emitProgress(listeners, {
      leads: [...collected],
      total,
      pagesScanned: pages,
    })
    offset += page.limit || DATA_LAB_LEADS_SCAN_PAGE_SIZE
    if (offset >= total || page.leads.length === 0) break
  }

  writeCache(key, {
    leads: collected,
    total,
    pagesScanned: pages,
  })

  return toResult(
    { leads: collected, total, pagesScanned: pages },
    { fromCache: false, lastPage, addedCount: 0 }
  )
}

async function runIncrementalRefresh(
  input: ScanInput,
  key: string,
  cached: CacheEntry,
  listeners: Set<(partial: ProgressPartial) => void>
): Promise<DataLabLeadsScanResult> {
  const knownIds = new Set(cached.leads.map(leadScanIdentity))
  const newest: DataExportLeadRow[] = []
  let offset = 0
  let total = cached.total
  let pages = 0
  let lastPage: DataExportDashboardData | null = null
  let hitKnown = false

  while (pages < DATA_LAB_LEADS_SCAN_INCREMENTAL_MAX_PAGES) {
    const page = await fetchPage(input, offset)
    if (!page) break
    lastPage = page
    total = page.total
    pages += 1

    const batch = takeNewerLeadsUntilKnown(page.leads, knownIds)
    for (const lead of batch.newer) {
      newest.push(lead)
      knownIds.add(leadScanIdentity(lead))
    }
    if (batch.hitKnown) {
      hitKnown = true
      break
    }
    if (page.leads.length === 0) break
    offset += page.limit || DATA_LAB_LEADS_SCAN_PAGE_SIZE
    if (offset >= total) break
  }

  if (
    !hitKnown &&
    newest.length >=
      DATA_LAB_LEADS_SCAN_INCREMENTAL_MAX_PAGES * DATA_LAB_LEADS_SCAN_PAGE_SIZE
  ) {
    return runFullScan(input, key, listeners)
  }

  const merged = newest.length > 0 ? [...newest, ...cached.leads] : cached.leads
  writeCache(key, {
    leads: merged,
    total,
    pagesScanned: cached.pagesScanned,
  })

  const result = toResult(
    { leads: merged, total, pagesScanned: cached.pagesScanned },
    {
      fromCache: newest.length === 0,
      lastPage,
      addedCount: newest.length,
    }
  )

  if (newest.length > 0) {
    emitProgress(listeners, {
      leads: merged,
      total,
      pagesScanned: cached.pagesScanned,
    })
  }

  return result
}

function attachListener(
  entry: InflightEntry,
  options?: {
    signal?: AbortSignal
    onProgress?: (partial: ProgressPartial) => void
  }
): (partial: ProgressPartial) => void {
  const listener = (partial: ProgressPartial) => {
    if (options?.signal?.aborted) return
    options?.onProgress?.(partial)
  }
  if (options?.onProgress) entry.listeners.add(listener)
  return listener
}

async function awaitInflight(
  entry: InflightEntry,
  listener: (partial: ProgressPartial) => void,
  signal?: AbortSignal
): Promise<DataLabLeadsScanResult> {
  try {
    const result = await entry.promise
    if (signal?.aborted) {
      const error = new Error("Aborted")
      error.name = "AbortError"
      throw error
    }
    return result
  } finally {
    entry.listeners.delete(listener)
  }
}

function startInflight(
  key: string,
  run: (
    listeners: Set<(partial: ProgressPartial) => void>
  ) => Promise<DataLabLeadsScanResult>
): InflightEntry {
  const listeners = new Set<(partial: ProgressPartial) => void>()
  const promise = run(listeners).finally(() => {
    const current = inflight.get(key)
    if (current?.promise === promise) inflight.delete(key)
  })
  const entry = { promise, listeners }
  inflight.set(key, entry)
  return entry
}

export async function loadDataLabLeadsScan(
  input: ScanInput,
  options?: {
    signal?: AbortSignal
    onProgress?: (partial: ProgressPartial) => void
    force?: boolean
    revalidate?: boolean
  }
): Promise<DataLabLeadsScanResult> {
  const key = buildDataLabLeadsScanCacheKey(input)
  const revalidate = options?.revalidate !== false

  if (!options?.force) {
    const cached = readCache(key)
    if (cached) {
      options?.onProgress?.({
        leads: cached.leads,
        total: cached.total,
        pagesScanned: cached.pagesScanned,
      })

      if (!revalidate) {
        return toResult(cached, {
          fromCache: true,
          lastPage: null,
          addedCount: 0,
        })
      }

      const refreshKey = `${key}::incremental`
      let entry = inflight.get(refreshKey)
      if (!entry) {
        entry = startInflight(refreshKey, (listeners) =>
          runIncrementalRefresh(input, key, cached, listeners)
        )
      }
      const listener = attachListener(entry, options)
      return awaitInflight(entry, listener, options?.signal)
    }
  }

  let entry = options?.force ? undefined : inflight.get(key)
  if (!entry) {
    entry = startInflight(key, (listeners) =>
      runFullScan(input, key, listeners)
    )
  }
  const listener = attachListener(entry, options)
  return awaitInflight(entry, listener, options?.signal)
}

export function peekDataLabLeadsScanCache(
  input: ScanInput
): DataLabLeadsScanResult | null {
  const cached = readCache(buildDataLabLeadsScanCacheKey(input))
  if (!cached) return null
  return toResult(cached, { fromCache: true, lastPage: null, addedCount: 0 })
}

export function __resetDataLabLeadsScanCacheForTests(): void {
  scanCache.clear()
  inflight.clear()
}
