import { db, sql } from '@workspace/database'
import { getClickHouseClient } from './clickhouse.service.js'

type CHJson<T> = { data: T[] }

const n = (v: unknown): number => (typeof v === 'number' ? v : Number(v ?? 0) || 0)
const mb = (bytes: unknown): number => Math.round((n(bytes) / 1024 / 1024) * 10) / 10
const gb = (bytes: unknown): number => Math.round((n(bytes) / 1024 / 1024 / 1024) * 100) / 100

const SAMPLE_LEN = 600

export type WorkloadRunningQuery = {
  queryId: string
  elapsedS: number
  readRows: number
  readMb: number
  memoryMb: number
  user: string
  query: string
}

export type WorkloadQueryShape = {
  hash: string
  calls: number
  errors: number
  totalMs: number
  avgMs: number
  maxMs: number
  readRows: number
  readGb: number
  peakMemoryMb: number
  tables: string[]
  sample: string
}

export type WorkloadTable = {
  table: string
  calls: number
  totalMs: number
  readRows: number
  readGb: number
}

export type WorkloadMerge = {
  table: string
  elapsedS: number
  progress: number
  rowsRead: number
  memoryMb: number
  numParts: number
  isMutation: boolean
}

export type WorkloadMutation = {
  table: string
  command: string
  partsToDo: number
  createdAt: string
  latestFailReason: string
}

export type WorkloadPostgresActivity = {
  pid: number
  state: string
  durationS: number
  waitEvent: string | null
  application: string
  query: string
}

export type WorkloadPostgresStatement = {
  calls: number
  totalMs: number
  meanMs: number
  rows: number
  query: string
}

export type WorkloadSnapshot = {
  windowMinutes: number
  clickhouse: {
    available: boolean
    error?: string
    metrics: Record<string, number>
    running: WorkloadRunningQuery[]
    topQueries: WorkloadQueryShape[]
    byTable: WorkloadTable[]
    merges: WorkloadMerge[]
    mutations: WorkloadMutation[]
    totals: { calls: number; errors: number; totalMs: number; readRows: number; readGb: number }
  }
  postgres: {
    available: boolean
    error?: string
    active: WorkloadPostgresActivity[]
    topStatements: WorkloadPostgresStatement[] | null
  }
  process: {
    rssMb: number
    heapUsedMb: number
    heapTotalMb: number
    externalMb: number
    arrayBuffersMb: number
    uptimeS: number
  }
  generatedAt: string
}

async function chRows<T>(query: string, params: Record<string, unknown> = {}): Promise<T[]> {
  const ch = getClickHouseClient()
  const res = await ch.query({ query, query_params: params, format: 'JSON' })
  return ((await res.json()) as CHJson<T>).data
}

const QUERY_LOG_WINDOW = `
  event_date >= toDate(now() - INTERVAL {minutes:UInt32} MINUTE)
  AND event_time >= now() - INTERVAL {minutes:UInt32} MINUTE
  AND type != 'QueryStart'
  AND is_initial_query
  AND query NOT ILIKE '%system.query_log%'
  AND query NOT ILIKE '%system.processes%'
`

async function loadClickHouseWorkload(
  minutes: number,
  limit: number,
): Promise<WorkloadSnapshot['clickhouse']> {
  const params = { minutes, limit }
  const [metricsRows, running, top, byTable, merges, mutations, totals] = await Promise.all([
    chRows<{ metric: string; value: string | number }>(`
      SELECT metric, value FROM system.asynchronous_metrics
      WHERE metric IN ('LoadAverage1', 'LoadAverage15', 'OSUserTimeNormalized', 'OSSystemTimeNormalized', 'MemoryResident', 'OSMemoryAvailable', 'OSMemoryTotal')
      UNION ALL
      SELECT metric, value FROM system.metrics
      WHERE metric IN ('Query', 'Merge', 'PartMutation', 'MemoryTracking', 'HTTPConnection', 'BackgroundMergesAndMutationsPoolTask')
    `),
    chRows<{
      query_id: string
      elapsed: string | number
      read_rows: string | number
      read_bytes: string | number
      memory_usage: string | number
      user: string
      query: string
    }>(`
      SELECT query_id, elapsed, read_rows, read_bytes, memory_usage, user, substring(query, 1, ${SAMPLE_LEN}) AS query
      FROM system.processes
      WHERE query NOT ILIKE '%system.processes%'
      ORDER BY elapsed DESC
      LIMIT {limit:UInt32}
    `, params),
    chRows<{
      hash: string
      calls: string | number
      errors: string | number
      total_ms: string | number
      max_ms: string | number
      read_rows: string | number
      read_bytes: string | number
      peak_memory: string | number
      tables: string[]
      sample: string
    }>(`
      SELECT
        toString(normalized_query_hash) AS hash,
        count() AS calls,
        countIf(exception_code != 0) AS errors,
        sum(query_duration_ms) AS total_ms,
        max(query_duration_ms) AS max_ms,
        sum(read_rows) AS read_rows,
        sum(read_bytes) AS read_bytes,
        max(memory_usage) AS peak_memory,
        arrayDistinct(arrayFlatten(groupArray(tables))) AS tables,
        any(substring(query, 1, ${SAMPLE_LEN})) AS sample
      FROM system.query_log
      WHERE ${QUERY_LOG_WINDOW}
      GROUP BY hash
      ORDER BY total_ms DESC
      LIMIT {limit:UInt32}
    `, params),
    chRows<{
      table: string
      calls: string | number
      total_ms: string | number
      read_rows: string | number
      read_bytes: string | number
    }>(`
      SELECT
        t AS table,
        count() AS calls,
        sum(query_duration_ms) AS total_ms,
        sum(read_rows) AS read_rows,
        sum(read_bytes) AS read_bytes
      FROM system.query_log
      ARRAY JOIN tables AS t
      WHERE ${QUERY_LOG_WINDOW}
        AND t NOT LIKE 'system.%'
        AND t NOT LIKE '%numbers%'
      GROUP BY t
      ORDER BY total_ms DESC
      LIMIT {limit:UInt32}
    `, params),
    chRows<{
      table: string
      elapsed: string | number
      progress: string | number
      rows_read: string | number
      memory_usage: string | number
      num_parts: string | number
      is_mutation: string | number
    }>(`
      SELECT table, elapsed, progress, rows_read, memory_usage, num_parts, is_mutation
      FROM system.merges
      ORDER BY elapsed DESC
      LIMIT {limit:UInt32}
    `, params),
    chRows<{
      table: string
      command: string
      parts_to_do: string | number
      create_time: string
      latest_fail_reason: string
    }>(`
      SELECT table, command, parts_to_do, toString(create_time) AS create_time, latest_fail_reason
      FROM system.mutations
      WHERE NOT is_done
      ORDER BY create_time
      LIMIT {limit:UInt32}
    `, params),
    chRows<{
      calls: string | number
      errors: string | number
      total_ms: string | number
      read_rows: string | number
      read_bytes: string | number
    }>(`
      SELECT
        count() AS calls,
        countIf(exception_code != 0) AS errors,
        sum(query_duration_ms) AS total_ms,
        sum(read_rows) AS read_rows,
        sum(read_bytes) AS read_bytes
      FROM system.query_log
      WHERE ${QUERY_LOG_WINDOW}
    `, params),
  ])

  const metrics: Record<string, number> = {}
  for (const row of metricsRows) metrics[row.metric] = n(row.value)
  const t = totals[0]

  return {
    available: true,
    metrics,
    running: running.map((r) => ({
      queryId: r.query_id,
      elapsedS: Math.round(n(r.elapsed) * 10) / 10,
      readRows: n(r.read_rows),
      readMb: mb(r.read_bytes),
      memoryMb: mb(r.memory_usage),
      user: r.user,
      query: r.query,
    })),
    topQueries: top.map((r) => {
      const calls = n(r.calls)
      const totalMs = n(r.total_ms)
      return {
        hash: r.hash,
        calls,
        errors: n(r.errors),
        totalMs,
        avgMs: calls ? Math.round(totalMs / calls) : 0,
        maxMs: n(r.max_ms),
        readRows: n(r.read_rows),
        readGb: gb(r.read_bytes),
        peakMemoryMb: mb(r.peak_memory),
        tables: r.tables ?? [],
        sample: r.sample,
      }
    }),
    byTable: byTable.map((r) => ({
      table: r.table,
      calls: n(r.calls),
      totalMs: n(r.total_ms),
      readRows: n(r.read_rows),
      readGb: gb(r.read_bytes),
    })),
    merges: merges.map((r) => ({
      table: r.table,
      elapsedS: Math.round(n(r.elapsed) * 10) / 10,
      progress: Math.round(n(r.progress) * 1000) / 10,
      rowsRead: n(r.rows_read),
      memoryMb: mb(r.memory_usage),
      numParts: n(r.num_parts),
      isMutation: n(r.is_mutation) === 1,
    })),
    mutations: mutations.map((r) => ({
      table: r.table,
      command: r.command,
      partsToDo: n(r.parts_to_do),
      createdAt: r.create_time,
      latestFailReason: r.latest_fail_reason,
    })),
    totals: {
      calls: n(t?.calls),
      errors: n(t?.errors),
      totalMs: n(t?.total_ms),
      readRows: n(t?.read_rows),
      readGb: gb(t?.read_bytes),
    },
  }
}

async function loadPostgresWorkload(limit: number): Promise<WorkloadSnapshot['postgres']> {
  const activeRes = await db.execute(sql`
    SELECT
      pid,
      state,
      EXTRACT(EPOCH FROM (now() - query_start))::float8 AS duration_s,
      wait_event,
      application_name,
      left(query, ${SAMPLE_LEN}) AS query
    FROM pg_stat_activity
    WHERE pid <> pg_backend_pid()
      AND state IS NOT NULL
      AND state <> 'idle'
      AND backend_type = 'client backend'
    ORDER BY query_start ASC NULLS LAST
    LIMIT ${limit}
  `)
  const activeRows = activeRes.rows as Record<string, unknown>[]
  const active: WorkloadPostgresActivity[] = activeRows.map((r) => ({
    pid: n(r.pid),
    state: String(r.state ?? ''),
    durationS: Math.round(n(r.duration_s) * 10) / 10,
    waitEvent: r.wait_event ? String(r.wait_event) : null,
    application: String(r.application_name ?? ''),
    query: String(r.query ?? ''),
  }))

  let topStatements: WorkloadPostgresStatement[] | null = null
  try {
    const stmtRes = await db.execute(sql`
      SELECT
        calls,
        total_exec_time AS total_ms,
        mean_exec_time AS mean_ms,
        rows,
        left(query, ${SAMPLE_LEN}) AS query
      FROM pg_stat_statements
      WHERE query NOT ILIKE '%pg_stat_statements%'
        AND query NOT ILIKE '%pg_stat_activity%'
      ORDER BY total_exec_time DESC
      LIMIT ${limit}
    `)
    const stmtRows = stmtRes.rows as Record<string, unknown>[]
    topStatements = stmtRows.map((r) => ({
      calls: n(r.calls),
      totalMs: Math.round(n(r.total_ms)),
      meanMs: Math.round(n(r.mean_ms) * 10) / 10,
      rows: n(r.rows),
      query: String(r.query ?? ''),
    }))
  } catch {
    topStatements = null
  }

  return { available: true, active, topStatements }
}

export async function getWorkloadSnapshot(input: {
  minutes?: number
  limit?: number
}): Promise<WorkloadSnapshot> {
  const minutes = Math.min(Math.max(Math.floor(input.minutes ?? 60), 1), 24 * 60)
  const limit = Math.min(Math.max(Math.floor(input.limit ?? 15), 1), 50)

  const [clickhouse, postgres] = await Promise.all([
    loadClickHouseWorkload(minutes, limit).catch((err: unknown) => ({
      available: false,
      error: err instanceof Error ? err.message : String(err),
      metrics: {},
      running: [],
      topQueries: [],
      byTable: [],
      merges: [],
      mutations: [],
      totals: { calls: 0, errors: 0, totalMs: 0, readRows: 0, readGb: 0 },
    })),
    loadPostgresWorkload(limit).catch((err: unknown) => ({
      available: false,
      error: err instanceof Error ? err.message : String(err),
      active: [],
      topStatements: null,
    })),
  ])

  const mem = process.memoryUsage()
  return {
    windowMinutes: minutes,
    clickhouse,
    postgres,
    process: {
      rssMb: mb(mem.rss),
      heapUsedMb: mb(mem.heapUsed),
      heapTotalMb: mb(mem.heapTotal),
      externalMb: mb(mem.external),
      arrayBuffersMb: mb(mem.arrayBuffers),
      uptimeS: Math.round(process.uptime()),
    },
    generatedAt: new Date().toISOString(),
  }
}
