import { resolveIngestApiBase } from "@/lib/server/analytics-env"

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

export type OpsDashboardData = {
  apiBase: string
  ready: OpsReadySnapshot | null
  metrics: OpsMetricsSnapshot | null
  readyError: string | null
  metricsError: string | null
  fetchedAt: string
}

async function fetchJson<T>(url: string): Promise<T> {
  const response = await fetch(url, {
    cache: "no-store",
    signal: AbortSignal.timeout(15_000),
  })
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`)
  }
  return (await response.json()) as T
}

export async function loadOpsDashboardData(): Promise<OpsDashboardData> {
  const apiBase = resolveIngestApiBase()
  const fetchedAt = new Date().toISOString()

  if (!apiBase) {
    return {
      apiBase: "",
      ready: null,
      metrics: null,
      readyError: "INGEST_BASE_URL is not configured",
      metricsError: "INGEST_BASE_URL is not configured",
      fetchedAt,
    }
  }

  const [readyResult, metricsResult] = await Promise.allSettled([
    fetchJson<OpsReadySnapshot>(`${apiBase}/health/ready`),
    fetchJson<OpsMetricsSnapshot>(`${apiBase}/health/metrics`),
  ])

  return {
    apiBase,
    ready: readyResult.status === "fulfilled" ? readyResult.value : null,
    metrics: metricsResult.status === "fulfilled" ? metricsResult.value : null,
    readyError:
      readyResult.status === "rejected"
        ? readyResult.reason instanceof Error
          ? readyResult.reason.message
          : "Failed to load readiness"
        : null,
    metricsError:
      metricsResult.status === "rejected"
        ? metricsResult.reason instanceof Error
          ? metricsResult.reason.message
          : "Failed to load metrics"
        : null,
    fetchedAt,
  }
}
