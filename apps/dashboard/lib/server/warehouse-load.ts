import {
  resolveIngestApiBase,
  resolveInternalApiSecret,
} from "@/lib/server/analytics-env"

export type WarehouseNameCount = {
  name: string
  count: number
}

export type WarehouseDomainCount = {
  domain: string
  count: number
  legit: number
  fraud: number
}

export type WarehouseSummary = {
  totals: {
    events: number
    sessions: number
    visitors: number
    workspacesWithEvents: number
    formStarts: number
    formSubmits: number
    formSuccesses: number
    scoredLeads: number
    landingPages: number
    workspaces: number
    users: number
  }
  volume: {
    lastHour: number
    last24h: number
    last7d: number
  }
  risk: {
    legit: number
    fraud: number
    unscoredFormSubmits: number
  }
  clicks: {
    total: number
    byName: WarehouseNameCount[]
  }
  eventsByName: WarehouseNameCount[]
  emailDomains: WarehouseDomainCount[]
  fraudReasons: WarehouseNameCount[]
  generatedAt: string
}

export type WarehouseDashboardData = {
  summary: WarehouseSummary | null
  error: string | null
  apiBase: string
  fetchedAt: string
}

function emptySummary(generatedAt: string): WarehouseSummary {
  return {
    totals: {
      events: 0,
      sessions: 0,
      visitors: 0,
      workspacesWithEvents: 0,
      formStarts: 0,
      formSubmits: 0,
      formSuccesses: 0,
      scoredLeads: 0,
      landingPages: 0,
      workspaces: 0,
      users: 0,
    },
    volume: { lastHour: 0, last24h: 0, last7d: 0 },
    risk: { legit: 0, fraud: 0, unscoredFormSubmits: 0 },
    clicks: { total: 0, byName: [] },
    eventsByName: [],
    emailDomains: [],
    fraudReasons: [],
    generatedAt,
  }
}

export async function loadWarehouseDashboardData(): Promise<WarehouseDashboardData> {
  const apiBase = resolveIngestApiBase()
  const fetchedAt = new Date().toISOString()

  if (!apiBase) {
    return {
      summary: null,
      error: "INGEST_BASE_URL is not configured",
      apiBase: "",
      fetchedAt,
    }
  }

  const secret = resolveInternalApiSecret()
  const headers: Record<string, string> = secret
    ? { "x-arohaa-internal": secret }
    : {}

  try {
    const response = await fetch(`${apiBase}/v1/warehouse/summary`, {
      cache: "no-store",
      headers,
      signal: AbortSignal.timeout(120_000),
    })
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`)
    }
    const summary = (await response.json()) as WarehouseSummary
    return {
      summary: {
        ...emptySummary(summary.generatedAt || fetchedAt),
        ...summary,
        totals: {
          ...emptySummary(fetchedAt).totals,
          ...summary.totals,
        },
        volume: {
          ...emptySummary(fetchedAt).volume,
          ...summary.volume,
        },
        risk: {
          ...emptySummary(fetchedAt).risk,
          ...summary.risk,
        },
        clicks: {
          total: Number(summary.clicks?.total ?? 0),
          byName: Array.isArray(summary.clicks?.byName)
            ? summary.clicks.byName
            : [],
        },
        eventsByName: Array.isArray(summary.eventsByName)
          ? summary.eventsByName
          : [],
        emailDomains: Array.isArray(summary.emailDomains)
          ? summary.emailDomains
          : [],
        fraudReasons: Array.isArray(summary.fraudReasons)
          ? summary.fraudReasons
          : [],
      },
      error: null,
      apiBase,
      fetchedAt,
    }
  } catch (err) {
    return {
      summary: null,
      error: err instanceof Error ? err.message : "Failed to load warehouse",
      apiBase,
      fetchedAt,
    }
  }
}
