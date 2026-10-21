import { randomUUID } from 'node:crypto'
import { existsSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { neon } from '@neondatabase/serverless'
import { createClient } from '@clickhouse/client'
import { Redis } from 'ioredis'

const here = path.dirname(fileURLToPath(import.meta.url))
const repoRoot = path.resolve(here, '../../..')

function loadEnvFile(filePath) {
  if (!existsSync(filePath)) return
  const text = readFileSync(filePath, 'utf8')
  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const eq = trimmed.indexOf('=')
    if (eq <= 0) continue
    const key = trimmed.slice(0, eq).trim()
    let value = trimmed.slice(eq + 1).trim()
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1)
    }
    if (process.env[key] === undefined) process.env[key] = value
  }
}

loadEnvFile(path.join(repoRoot, 'apps/dashboard/.env.local'))
loadEnvFile(path.join(repoRoot, 'apps/api/.env.local'))

const API_BASE = (process.env.GATE_API_BASE || 'http://127.0.0.1:3001').replace(
  /\/$/,
  '',
)
const INTERNAL = process.env.AROHAA_INTERNAL_API_SECRET?.trim() || ''
const CH = {
  url: process.env.CLICKHOUSE_URL?.trim() || 'http://127.0.0.1:8123',
  username: process.env.CLICKHOUSE_USER?.trim() || 'default',
  password: process.env.CLICKHOUSE_PASSWORD ?? 'localdev',
}
const REDIS_URL = process.env.REDIS_URL?.trim() || 'redis://127.0.0.1:6379'

function fail(msg) {
  console.error(`FAIL: ${msg}`)
  process.exit(1)
}

function ok(msg) {
  console.log(`OK: ${msg}`)
}

async function sleep(ms) {
  await new Promise((r) => setTimeout(r, ms))
}

async function fetchLanding() {
  const url = process.env.DATABASE_URL
  if (!url) fail('DATABASE_URL missing')
  const sql = neon(url)
  const rows = await sql`
    SELECT
      lp.id,
      lp."workspaceId" AS "workspaceId",
      lp."publicId" AS "publicId",
      lp.origin,
      lp.hostname,
      lp.status
    FROM landing_page lp
    WHERE lp."deletedAt" IS NULL
      AND lp.status <> 'inactive'
    ORDER BY lp."updatedAt" DESC NULLS LAST
    LIMIT 1
  `
  if (!rows[0]) fail('No active landing_page found in DATABASE_URL')
  return rows[0]
}

async function postIngest(body, origin) {
  const res = await fetch(`${API_BASE}/v1/ingest`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      origin,
    },
    body: JSON.stringify(body),
  })
  const text = await res.text()
  return { status: res.status, text, traceId: res.headers.get('x-trace-id') }
}

async function waitForEvent(ch, { workspaceId, sessionId, eventId, timeoutMs }) {
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    const res = await ch.query({
      query: `
        SELECT count() AS cnt
        FROM events_raw
        WHERE workspace_id = {workspaceId:UUID}
          AND session_id = {sessionId:String}
          AND event_id = {eventId:String}
      `,
      query_params: { workspaceId, sessionId, eventId },
      format: 'JSON',
    })
    const json = await res.json()
    if (Number(json.data?.[0]?.cnt ?? 0) > 0) return true
    await sleep(500)
  }
  return false
}

async function main() {
  console.log('Release gate pipeline')
  console.log(`  API_BASE=${API_BASE}`)
  console.log(`  REDIS_URL=${REDIS_URL}`)
  console.log(`  CLICKHOUSE_URL=${CH.url}`)

  const health = await fetch(`${API_BASE}/health`).catch((e) => {
    fail(`API not reachable at ${API_BASE}: ${e.message}`)
  })
  if (!health.ok) fail(`API health ${health.status}`)
  ok('API health')

  const landing = await fetchLanding()
  ok(`landing ${landing.publicId} (${landing.hostname})`)

  const redis = new Redis(REDIS_URL, {
    maxRetriesPerRequest: 1,
    connectTimeout: 2000,
  })
  await redis.ping()
  const queueBefore = await redis.llen('analytics_queue')
  const deadBefore = await redis.llen('visit_assess_dead')
  ok(`Redis ping (analytics_queue=${queueBefore}, visit_assess_dead=${deadBefore})`)

  const ch = createClient({ ...CH, request_timeout: 10_000 })
  await ch.query({ query: 'SELECT 1', format: 'JSON' })
  ok('ClickHouse ping')

  const sessionId = `gate-${Date.now()}`
  const eventId = randomUUID()
  const oldSdkEventId = randomUUID()
  const origin = landing.origin || `https://${landing.hostname}`
  const pageUrl = `${origin}/`

  const base = {
    workspace_id: landing.id,
    lp_id: landing.publicId,
    sid: sessionId,
    uid: `uid-gate-${Date.now()}`,
    fp: 'abcdef0123456789',
    url: pageUrl,
    sdk_version: '9.9.9-gate',
    sdk_capabilities: 'fi,seq,session_token,browser_obs',
    utm_source: 'release_gate',
    referrer: `${origin}/ref`,
  }

  const first = await postIngest(
    {
      ...base,
      event_id: eventId,
      event_name: 'sdk_connected',
      seq: 1,
      props: { browser_obs: { webdriver: false, gate: true } },
    },
    origin,
  )
  if (first.status !== 202) {
    fail(`ingest sdk_connected expected 202 got ${first.status}: ${first.text}`)
  }
  ok(`ingest sdk_connected 202 trace=${first.traceId || 'n/a'}`)

  const dup = await postIngest(
    {
      ...base,
      event_id: eventId,
      event_name: 'sdk_connected',
      seq: 1,
      props: { browser_obs: { webdriver: false, gate: true } },
    },
    origin,
  )
  if (dup.status !== 202 && dup.status !== 200) {
    fail(`duplicate ingest unexpected ${dup.status}: ${dup.text}`)
  }
  ok(`duplicate event_id accepted without second write (${dup.status})`)

  const summaryId = randomUUID()
  const summary = await postIngest(
    {
      ...base,
      event_id: summaryId,
      event_name: 'behavior_summary',
      seq: 2,
      props: { visible_ms: 1500, active_ms: 900, gate: true },
    },
    origin,
  )
  if (summary.status !== 202) {
    fail(`ingest behavior_summary expected 202 got ${summary.status}: ${summary.text}`)
  }
  ok('ingest behavior_summary 202')

  const oldSdk = await postIngest(
    {
      ...base,
      event_id: oldSdkEventId,
      event_name: 'page_view',
      seq: 3,
      sdk_version: '',
      sdk_capabilities: '',
      props: { legacy: true },
    },
    origin,
  )
  if (oldSdk.status !== 202) {
    fail(`ingest old-sdk page_view expected 202 got ${oldSdk.status}: ${oldSdk.text}`)
  }
  ok('ingest older-SDK-shaped page_view 202')

  const persisted = await waitForEvent(ch, {
    workspaceId: landing.id,
    sessionId,
    eventId,
    timeoutMs: 45_000,
  })
  if (!persisted) fail('event did not land in ClickHouse within 45s (is worker running?)')
  ok('ClickHouse has sdk_connected event')

  const summaryPersisted = await waitForEvent(ch, {
    workspaceId: landing.id,
    sessionId,
    eventId: summaryId,
    timeoutMs: 30_000,
  })
  if (!summaryPersisted) fail('behavior_summary missing in ClickHouse')
  ok('ClickHouse has behavior_summary')

  if (!INTERNAL) fail('AROHAA_INTERNAL_API_SECRET missing for session-evidence')
  const evidenceUrl = new URL(`${API_BASE}/v1/warehouse/session-evidence`)
  evidenceUrl.searchParams.set('workspaceId', landing.id)
  evidenceUrl.searchParams.set('sessionId', sessionId)
  evidenceUrl.searchParams.set('tenantWorkspaceId', landing.workspaceId)

  const evidenceRes = await fetch(evidenceUrl, {
    headers: { 'x-arohaa-internal': INTERNAL },
  })
  const evidenceBody = await evidenceRes.json()
  if (evidenceRes.status !== 200) {
    fail(`session-evidence ${evidenceRes.status}: ${JSON.stringify(evidenceBody)}`)
  }
  if (!evidenceBody.timeline?.length) fail('session-evidence timeline empty')
  if (evidenceBody.sessionId !== sessionId) fail('session-evidence session mismatch')
  ok(
    `session-evidence dialog payload (events=${evidenceBody.timeline.length}, sdk=${evidenceBody.sdkVersion || 'n/a'})`,
  )

  const foreign = await fetch(
    `${API_BASE}/v1/warehouse/session-evidence?workspaceId=${landing.id}&sessionId=${sessionId}&tenantWorkspaceId=${randomUUID()}`,
    { headers: { 'x-arohaa-internal': INTERNAL } },
  )
  if (foreign.status !== 404) {
    fail(`cross-tenant session-evidence expected 404 got ${foreign.status}`)
  }
  ok('cross-tenant session-evidence isolated (404)')

  const deadAfter = await redis.llen('visit_assess_dead')
  ok(`visit_assess_dead delta=${deadAfter - deadBefore}`)

  const cntRes = await ch.query({
    query: `
      SELECT count() AS cnt
      FROM events_raw
      WHERE workspace_id = {workspaceId:UUID}
        AND session_id = {sessionId:String}
        AND event_id = {eventId:String}
    `,
    query_params: { workspaceId: landing.id, sessionId, eventId },
    format: 'JSON',
  })
  const cntJson = await cntRes.json()
  if (Number(cntJson.data?.[0]?.cnt ?? 0) !== 1) {
    fail(`duplicate events in CH for same event_id: ${cntJson.data?.[0]?.cnt}`)
  }
  ok('no duplicate ClickHouse rows for retry event_id')

  await redis.quit()
  await ch.close()
  console.log('PASS: release-gate pipeline')
  console.log(
    JSON.stringify(
      {
        sessionId,
        workspaceId: landing.id,
        tenantWorkspaceId: landing.workspaceId,
        publicId: landing.publicId,
        eventId,
        summaryId,
      },
      null,
      2,
    ),
  )
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
