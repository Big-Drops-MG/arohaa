import { cookies, headers } from "next/headers"
import {
  resolveIngestApiBase,
  resolveInternalApiSecret,
} from "@/lib/server/analytics-env"

export type OpsDependencyStatus = "ok" | "unreachable" | string

export type OpsReadySnapshot = {
  status: string
  dependencies: {
    clickhouse: OpsDependencyStatus
    redis: OpsDependencyStatus
    postgres: OpsDependencyStatus
  }
  queues: {
    analytics_queue: number
    failed_events: number
  }
  latency_ms: number
  timestamp: string
}

export type OpsMetricsSnapshot = {
  status: string
  events: {
    total: number
    last_hour: number
    last_24h: number
  }
  queues: {
    analytics_queue: number
    failed_events: number
  }
  timestamp: string
}

export type OpsDependencyDetail = {
  status: OpsDependencyStatus
  latency_ms: number
}

export type OpsDetailedSnapshot = {
  status: string
  service: string
  version: string
  environment: string
  region: string
  uptime_s: number
  dependencies: {
    clickhouse: OpsDependencyDetail
    redis: OpsDependencyDetail
    postgres: OpsDependencyDetail
  }
  queues: {
    analytics_queue: number
    failed_events: number
  }
  system: {
    node: string
    pid: number
    memory_rss_mb: number
    memory_heap_used_mb: number
    memory_heap_total_mb: number
  }
  timestamp: string
}

export type OpsEndpointCheck = {
  name: string
  method: string
  path: string
  httpStatus: number | null
  reachable: boolean
  latencyMs: number
}

export type OpsEndpointGroup = {
  title: string
  baseLabel: string
  checks: OpsEndpointCheck[]
}

export type OpsQueueItem = {
  event_name: string | null
  url: string | null
  workspace_id: string | null
  created_at: string | null
  json: string
}

export type OpsFailedItem = {
  reason: string
  timestamp: number | null
  json: string
}

export type OpsQueuesSnapshot = {
  status: string
  limit: number
  analytics_queue: {
    depth: number
    sample: OpsQueueItem[]
  }
  failed_events: {
    depth: number
    sample: OpsFailedItem[]
  }
  timestamp: string
}

export type OpsDashboardData = {
  apiBase: string
  ready: OpsReadySnapshot | null
  metrics: OpsMetricsSnapshot | null
  detailed: OpsDetailedSnapshot | null
  queues: OpsQueuesSnapshot | null
  readyError: string | null
  metricsError: string | null
  detailedError: string | null
  queuesError: string | null
  endpointGroups: OpsEndpointGroup[]
  fetchedAt: string
}

const PROBE_TIMEOUT_MS = 5_000
const DASH_PROBE_ID = "__ops_probe__"

type EndpointDef = { name: string; method: string; path: string }

const INGEST_HEALTH_ENDPOINTS: EndpointDef[] = [
  { name: "Health", method: "GET", path: "/health" },
  { name: "Readiness", method: "GET", path: "/health/ready" },
  { name: "Metrics", method: "GET", path: "/health/metrics" },
  { name: "Detailed", method: "GET", path: "/health/detailed" },
  { name: "Ingest", method: "POST", path: "/v1/ingest" },
]

const INGEST_ANALYTICS_ENDPOINTS: EndpointDef[] = [
  {
    name: "Analytics: overview",
    method: "GET",
    path: "/v1/analytics/overview",
  },
  { name: "Analytics: traffic", method: "GET", path: "/v1/analytics/traffic" },
  { name: "Analytics: funnel", method: "GET", path: "/v1/analytics/funnel" },
  { name: "Analytics: events", method: "GET", path: "/v1/analytics/events" },
  {
    name: "Analytics: segments",
    method: "GET",
    path: "/v1/analytics/segments",
  },
  {
    name: "Analytics: experiments",
    method: "GET",
    path: "/v1/analytics/experiments",
  },
  { name: "Analytics: alerts", method: "GET", path: "/v1/analytics/alerts" },
  { name: "Analytics: seo", method: "GET", path: "/v1/analytics/seo" },
  {
    name: "Analytics: landing summary",
    method: "GET",
    path: "/v1/analytics/landing-summary",
  },
  {
    name: "Analytics: utm discovered",
    method: "GET",
    path: "/v1/analytics/utm-discovered",
  },
  {
    name: "Analytics: utm values",
    method: "GET",
    path: "/v1/analytics/utm-values",
  },
]

const DASHBOARD_ENDPOINTS: EndpointDef[] = [
  { name: "Landing pages (list)", method: "GET", path: "/api/landing-pages" },
  { name: "Notifications", method: "GET", path: "/api/notifications" },
  {
    name: "Workspace API keys",
    method: "GET",
    path: "/api/workspace/api-keys",
  },
  {
    name: "Workspace alert webhooks",
    method: "GET",
    path: "/api/workspace/alert-webhooks",
  },
  {
    name: "Overview",
    method: "GET",
    path: `/api/landing-pages/${DASH_PROBE_ID}/overview`,
  },
  {
    name: "Traffic",
    method: "GET",
    path: `/api/landing-pages/${DASH_PROBE_ID}/traffic`,
  },
  {
    name: "Funnel",
    method: "GET",
    path: `/api/landing-pages/${DASH_PROBE_ID}/funnel`,
  },
  {
    name: "Events",
    method: "GET",
    path: `/api/landing-pages/${DASH_PROBE_ID}/events`,
  },
  {
    name: "Segments",
    method: "GET",
    path: `/api/landing-pages/${DASH_PROBE_ID}/segments`,
  },
  {
    name: "Experiments",
    method: "GET",
    path: `/api/landing-pages/${DASH_PROBE_ID}/experiments`,
  },
  {
    name: "Alerts",
    method: "GET",
    path: `/api/landing-pages/${DASH_PROBE_ID}/alerts`,
  },
  {
    name: "SEO",
    method: "GET",
    path: `/api/landing-pages/${DASH_PROBE_ID}/seo`,
  },
  {
    name: "UTM",
    method: "GET",
    path: `/api/landing-pages/${DASH_PROBE_ID}/utm`,
  },
  {
    name: "UTM values",
    method: "GET",
    path: `/api/landing-pages/${DASH_PROBE_ID}/utm-values`,
  },
]

async function fetchJson<T>(
  url: string,
  headersInit?: Record<string, string>
): Promise<T> {
  const response = await fetch(url, {
    cache: "no-store",
    headers: headersInit,
    signal: AbortSignal.timeout(15_000),
  })
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`)
  }
  return (await response.json()) as T
}

async function probeEndpoint(
  base: string,
  def: EndpointDef,
  headersInit: Record<string, string>
): Promise<OpsEndpointCheck> {
  const url = `${base}${def.path}`
  const start = Date.now()
  try {
    const response = await fetch(url, {
      method: def.method,
      headers: headersInit,
      cache: "no-store",
      signal: AbortSignal.timeout(PROBE_TIMEOUT_MS),
      ...(def.method === "POST" ? { body: "{}" } : {}),
    })
    return {
      name: def.name,
      method: def.method,
      path: def.path,
      httpStatus: response.status,
      reachable: response.status < 500,
      latencyMs: Date.now() - start,
    }
  } catch {
    return {
      name: def.name,
      method: def.method,
      path: def.path,
      httpStatus: null,
      reachable: false,
      latencyMs: Date.now() - start,
    }
  }
}

async function probeGroup(
  base: string,
  defs: EndpointDef[],
  headersInit: Record<string, string>,
  concurrency = 8
): Promise<OpsEndpointCheck[]> {
  const results: OpsEndpointCheck[] = new Array(defs.length)
  let next = 0

  async function worker() {
    while (next < defs.length) {
      const index = next
      next += 1
      const def = defs[index]
      if (!def) continue
      results[index] = await probeEndpoint(base, def, headersInit)
    }
  }

  const workers = Array.from(
    { length: Math.min(concurrency, Math.max(1, defs.length)) },
    () => worker()
  )
  await Promise.all(workers)
  return results
}

async function resolveDashboardOrigin(): Promise<string | null> {
  try {
    const h = await headers()
    const host = h.get("host")
    if (!host) return null
    const proto =
      h.get("x-forwarded-proto") ??
      (process.env.NODE_ENV === "development" ? "http" : "https")
    return `${proto}://${host}`
  } catch {
    return null
  }
}

async function resolveCookieHeader(): Promise<string> {
  try {
    const store = await cookies()
    return store
      .getAll()
      .map((c) => `${c.name}=${c.value}`)
      .join("; ")
  } catch {
    return ""
  }
}

export async function loadOpsDashboardData(): Promise<OpsDashboardData> {
  const apiBase = resolveIngestApiBase()
  const fetchedAt = new Date().toISOString()

  if (!apiBase) {
    return {
      apiBase: "",
      ready: null,
      metrics: null,
      detailed: null,
      queues: null,
      readyError: "INGEST_BASE_URL is not configured",
      metricsError: "INGEST_BASE_URL is not configured",
      detailedError: "INGEST_BASE_URL is not configured",
      queuesError: "INGEST_BASE_URL is not configured",
      endpointGroups: [],
      fetchedAt,
    }
  }

  const secret = resolveInternalApiSecret()
  const ingestHeaders: Record<string, string> = secret
    ? { "x-arohaa-internal": secret }
    : {}

  const dashboardOrigin = await resolveDashboardOrigin()
  const cookieHeader = await resolveCookieHeader()

  const [
    readyResult,
    metricsResult,
    detailedResult,
    queuesResult,
    healthChecks,
  ] = await Promise.all([
    Promise.allSettled([
      fetchJson<OpsReadySnapshot>(`${apiBase}/health/ready`),
    ]).then((r) => r[0]),
    Promise.allSettled([
      fetchJson<OpsMetricsSnapshot>(`${apiBase}/health/metrics`),
    ]).then((r) => r[0]),
    Promise.allSettled([
      fetchJson<OpsDetailedSnapshot>(`${apiBase}/health/detailed`),
    ]).then((r) => r[0]),
    Promise.allSettled([
      fetchJson<OpsQueuesSnapshot>(
        `${apiBase}/health/queues?limit=25`,
        ingestHeaders
      ),
    ]).then((r) => r[0]),
    probeGroup(apiBase, INGEST_HEALTH_ENDPOINTS, ingestHeaders, 5),
  ])

  const analyticsChecks = await probeGroup(
    apiBase,
    INGEST_ANALYTICS_ENDPOINTS,
    ingestHeaders,
    2
  )
  const ingestChecks = [...healthChecks, ...analyticsChecks]

  const dashboardChecks =
    dashboardOrigin && cookieHeader
      ? await probeGroup(
          dashboardOrigin,
          DASHBOARD_ENDPOINTS,
          { cookie: cookieHeader },
          2
        )
      : []

  const endpointGroups: OpsEndpointGroup[] = [
    {
      title: "Ingestion API",
      baseLabel: apiBase,
      checks: ingestChecks,
    },
  ]

  if (dashboardChecks.length > 0) {
    endpointGroups.push({
      title: "Dashboard API",
      baseLabel: dashboardOrigin ?? "dashboard",
      checks: dashboardChecks,
    })
  }

  const errorMessage = (
    result: PromiseSettledResult<unknown>,
    fallback: string
  ) =>
    result.status === "rejected"
      ? result.reason instanceof Error
        ? result.reason.message
        : fallback
      : null

  return {
    apiBase,
    ready: readyResult.status === "fulfilled" ? readyResult.value : null,
    metrics: metricsResult.status === "fulfilled" ? metricsResult.value : null,
    detailed:
      detailedResult.status === "fulfilled" ? detailedResult.value : null,
    queues: queuesResult.status === "fulfilled" ? queuesResult.value : null,
    readyError: errorMessage(readyResult, "Failed to load readiness"),
    metricsError: errorMessage(metricsResult, "Failed to load metrics"),
    detailedError: errorMessage(detailedResult, "Failed to load detailed"),
    queuesError: errorMessage(queuesResult, "Failed to load queues"),
    endpointGroups,
    fetchedAt,
  }
}
