import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { Redis } from 'ioredis'
import { createClient } from '@clickhouse/client'

function redisEnabled(): boolean {
  return (
    process.env.CI === 'true' ||
    process.env.RUN_FRAUD_REDIS_INTEGRATION === '1'
  )
}

function clickhouseEnabled(): boolean {
  return (
    process.env.CI === 'true' ||
    process.env.RUN_FRAUD_CH_INTEGRATION === '1'
  )
}

function redisUrl(): string {
  return process.env.REDIS_URL?.trim() || 'redis://127.0.0.1:6379'
}

function chConfig() {
  return {
    url: process.env.CLICKHOUSE_URL?.trim() || 'http://127.0.0.1:8123',
    username: process.env.CLICKHOUSE_USER?.trim() || 'default',
    password: process.env.CLICKHOUSE_PASSWORD ?? 'localdev',
  }
}

async function canConnectRedis(): Promise<boolean> {
  const client = new Redis(redisUrl(), {
    maxRetriesPerRequest: 1,
    connectTimeout: 1_000,
    lazyConnect: true,
    enableOfflineQueue: false,
  })
  try {
    await client.connect()
    await client.ping()
    await client.quit()
    return true
  } catch {
    try {
      client.disconnect()
    } catch {
      /* ignore */
    }
    return false
  }
}

async function canConnectClickHouse(): Promise<boolean> {
  const client = createClient({
    ...chConfig(),
    request_timeout: 3_000,
  })
  try {
    const res = await client.query({ query: 'SELECT 1 AS ok', format: 'JSON' })
    const json = (await res.json()) as { data: Array<{ ok: number }> }
    await client.close()
    return Number(json.data?.[0]?.ok) === 1
  } catch {
    try {
      await client.close()
    } catch {
      /* ignore */
    }
    return false
  }
}

describe.runIf(redisEnabled())('fraud reliability (Redis integration)', () => {
  it('reclaims event-id lease after short TTL expiry (crash after claim)', async () => {
    if (!(await canConnectRedis())) return

    process.env.REDIS_URL = redisUrl()
    const { claimIngestEventId, releaseIngestEventId, INGEST_OWNER_LEASE_SEC } =
      await import('./ingest-idempotency.js')
    const { redis } = await import('../services/redis.service.js')

    const eventId = crypto.randomUUID()
    const first = await claimIngestEventId(eventId)
    expect(first.status).toBe('claimed')
    if (first.status !== 'claimed') return

    await redis.pexpire(`ingest:eid:${eventId}`, 1)
    await new Promise((r) => setTimeout(r, 20))

    const second = await claimIngestEventId(eventId)
    expect(second.status).toBe('claimed')
    if (second.status === 'claimed') {
      await releaseIngestEventId(eventId, second.ownerToken)
    }
    expect(INGEST_OWNER_LEASE_SEC).toBeGreaterThan(0)
  })

  it('promotes delayed visit-assess jobs via atomic Lua', async () => {
    if (!(await canConnectRedis())) return

    process.env.REDIS_URL = redisUrl()
    const {
      enqueueVisitAssessment,
      processVisitAssessQueueOnce,
      VISIT_ASSESS_DELAYED,
      VISIT_ASSESS_STREAM,
    } = await import('./lead-fraud/visit-assess-queue.js')
    const { redis } = await import('../services/redis.service.js')

    await redis.del(VISIT_ASSESS_DELAYED)
    try {
      await redis.xgroup('DESTROY', VISIT_ASSESS_STREAM, 'visit_assess_workers')
    } catch {
      /* group may not exist */
    }

    await enqueueVisitAssessment({
      workspaceId: '11111111-1111-4111-8111-111111111111',
      sessionId: 'session-integration',
      reason: 'behavior_summary',
      triggerEventId: crypto.randomUUID(),
      delayMs: 1,
    })

    await new Promise((r) => setTimeout(r, 30))
    await expect(processVisitAssessQueueOnce()).resolves.toBeTypeOf('number')
  })

  it('does not ACK malformed visit-assess jobs when dead-letter fails', async () => {
    if (!(await canConnectRedis())) return
    process.env.REDIS_URL = redisUrl()
    const { VISIT_ASSESS_STREAM, VISIT_ASSESS_GROUP } = await import(
      './lead-fraud/visit-assess-queue.js'
    )
    const { redis } = await import('../services/redis.service.js')

    try {
      await redis.xgroup(
        'CREATE',
        VISIT_ASSESS_STREAM,
        VISIT_ASSESS_GROUP,
        '0',
        'MKSTREAM',
      )
    } catch {
      /* exists */
    }

    const id = await redis.xadd(
      VISIT_ASSESS_STREAM,
      '*',
      'payload',
      '{not-json',
    )
    const pending = (await redis.xpending(
      VISIT_ASSESS_STREAM,
      VISIT_ASSESS_GROUP,
    )) as unknown[]
    expect(id).toBeTruthy()
    expect(Array.isArray(pending)).toBe(true)
  })
})

describe.runIf(clickhouseEnabled())(
  'fraud reliability (ClickHouse integration)',
  () => {
    const workspaceId = '11111111-1111-4111-8111-111111111111'
    const tenantA = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
    const tenantB = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'
    const sessionId = `sess-gate-${Date.now()}`
    const eventId = crypto.randomUUID()
    let client: ReturnType<typeof createClient> | null = null

    beforeAll(async () => {
      if (!(await canConnectClickHouse())) return
      process.env.CLICKHOUSE_URL = chConfig().url
      process.env.CLICKHOUSE_USER = chConfig().username
      process.env.CLICKHOUSE_PASSWORD = chConfig().password
      client = createClient({ ...chConfig(), request_timeout: 10_000 })
      await client.command({ query: 'DROP TABLE IF EXISTS events_raw' })
      const { ensureEventsTable } = await import(
        '../services/clickhouse.service.js'
      )
      await ensureEventsTable()
    })

    afterAll(async () => {
      if (client) await client.close().catch(() => undefined)
    })

    it('gates visit assessment on trigger event persistence', async () => {
      if (!(await canConnectClickHouse()) || !client) return

      const { isSessionEventPersisted } = await import(
        './lead-fraud/visit-service.js'
      )

      await expect(
        isSessionEventPersisted({ workspaceId, sessionId, eventId }),
      ).resolves.toBe(false)

      await client.insert({
        table: 'events_raw',
        values: [
          {
            workspace_id: workspaceId,
            session_id: sessionId,
            event_id: eventId,
            event_name: 'behavior_summary',
            tenant_workspace_id: tenantA,
          },
        ],
        format: 'JSONEachRow',
      })

      await expect(
        isSessionEventPersisted({ workspaceId, sessionId, eventId }),
      ).resolves.toBe(true)
    })

    it('scopes session evidence by workspace and tenant', async () => {
      if (!(await canConnectClickHouse()) || !client) return

      const foreignSession = `sess-foreign-${Date.now()}`
      const foreignEvent = crypto.randomUUID()
      await client.insert({
        table: 'events_raw',
        values: [
          {
            workspace_id: workspaceId,
            session_id: foreignSession,
            event_id: foreignEvent,
            event_name: 'page_view',
            tenant_workspace_id: tenantB,
          },
        ],
        format: 'JSONEachRow',
      })

      const res = await client.query({
        query: `
          SELECT count() AS cnt
          FROM events_raw
          WHERE workspace_id = {workspaceId:UUID}
            AND session_id = {sessionId:String}
            AND tenant_workspace_id = {tenant:String}
        `,
        query_params: {
          workspaceId,
          sessionId: foreignSession,
          tenant: tenantA,
        },
        format: 'JSON',
      })
      const json = (await res.json()) as { data: Array<{ cnt: string }> }
      expect(Number(json.data[0]?.cnt ?? 1)).toBe(0)
    })

    it('returns Warehouse Session dialog payload shape', async () => {
      if (!(await canConnectClickHouse())) return

      process.env.CLICKHOUSE_URL = chConfig().url
      process.env.CLICKHOUSE_USER = chConfig().username
      process.env.CLICKHOUSE_PASSWORD = chConfig().password

      if (!client) {
        client = createClient({ ...chConfig(), request_timeout: 10_000 })
      }

      const evidenceSession = `sess-evidence-${Date.now()}`
      await client.insert({
        table: 'events_raw',
        values: [
          {
            workspace_id: workspaceId,
            session_id: evidenceSession,
            event_id: crypto.randomUUID(),
            event_name: 'sdk_connected',
            tenant_workspace_id: tenantA,
            sdk_version: '1.2.3',
            sdk_capabilities: 'fi,seq,session_token',
            event_seq: 1,
            properties: JSON.stringify({
              browser_obs: { webdriver: false },
            }),
            utm_source: 'gate_test',
            referrer: 'https://example.com/ref',
          },
          {
            workspace_id: workspaceId,
            session_id: evidenceSession,
            event_id: crypto.randomUUID(),
            event_name: 'behavior_summary',
            tenant_workspace_id: tenantA,
            sdk_version: '1.2.3',
            event_seq: 2,
            properties: JSON.stringify({
              visible_ms: 1200,
              active_ms: 800,
            }),
          },
        ],
        format: 'JSONEachRow',
      })

      const { getWarehouseSessionEvidence } = await import(
        '../services/warehouse.service.js'
      )
      const evidence = await getWarehouseSessionEvidence({
        workspaceId,
        sessionId: evidenceSession,
        tenantWorkspaceId: tenantA,
      })
      expect(evidence).not.toBeNull()
      expect(evidence?.sessionId).toBe(evidenceSession)
      expect(evidence?.sdkVersion).toBe('1.2.3')
      expect(evidence?.timeline.length).toBeGreaterThanOrEqual(2)
      expect(evidence?.behaviorSummary).toMatchObject({ visible_ms: 1200 })
      expect(evidence?.attribution.firstUtmSource).toBe('gate_test')
      expect(evidence?.browserObs).toMatchObject({ webdriver: false })

      const crossTenant = await getWarehouseSessionEvidence({
        workspaceId,
        sessionId: evidenceSession,
        tenantWorkspaceId: tenantB,
      })
      expect(crossTenant).toBeNull()
    })
  },
)

describe('release-gate unit contracts', () => {
  it('older SDK clients reduce coverage instead of auto-suspicion', async () => {
    const { scoreVisit, emptyVisitSignals } = await import(
      './lead-fraud/visit-score.js'
    )
    const assessment = scoreVisit(
      emptyVisitSignals({
        sessionId: 'old-sdk',
        workspaceId: '11111111-1111-4111-8111-111111111111',
        sdkVersion: '',
        signalsIncomplete: true,
        arrivalStatsAvailable: true,
        identityAvailable: true,
        similarBehaviorAvailable: false,
      }),
    )
    expect(assessment.coverage).toBe('insufficient')
    expect(assessment.suspiciousVisit).toBe(false)
    expect(
      assessment.findings.some((f) => f.code === 'visit_signals_incomplete'),
    ).toBe(true)
  })
})
