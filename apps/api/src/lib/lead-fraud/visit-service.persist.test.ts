import { afterEach, describe, expect, it, vi } from 'vitest'

const { upsertVisitRisk, loadSessionShadowEvidence, query } = vi.hoisted(() => ({
  upsertVisitRisk: vi.fn(),
  loadSessionShadowEvidence: vi.fn(),
  query: vi.fn(),
}))

vi.mock('./visit-persist.js', () => ({
  upsertVisitRisk,
}))

vi.mock('./session-evidence-load.js', () => ({
  loadSessionShadowEvidence,
}))

vi.mock('../../services/clickhouse.service.js', () => ({
  getClickHouseClient: () => ({ query }),
}))

import {
  ensureSessionVisitAssessment,
  isSessionEventPersisted,
  VisitAssessNotReadyError,
} from './visit-service.js'

function evidenceFixture() {
  return {
    integrityFindings: [],
    browserFindings: [],
    pageIntegrityFindings: [],
    sdkVersion: '1.1.0',
    sdkCapabilities: 'behavior_summary',
    visibleMs: 1000,
    activeMs: 500,
    hasMeaningfulInteraction: true,
    hasFormEngagement: false,
    formSubmitted: false,
    arrivedAtMs: Date.now() - 10_000,
    departedAtMs: Date.now(),
    evidenceCutoffMs: Date.now(),
    evidenceTruncated: false,
    eventCount: 3,
    baselineVersion: null,
    stableEvidenceKey: 'k',
  }
}

describe('visit assessment persistence and trigger gating', () => {
  afterEach(() => {
    vi.clearAllMocks()
  })

  it('throws when the triggering event is not persisted yet', async () => {
    query.mockResolvedValue({
      json: async () => ({ data: [] }),
    })

    await expect(
      ensureSessionVisitAssessment({
        workspaceId: '11111111-1111-4111-8111-111111111111',
        sessionId: 'session-abcdefgh',
        triggerEventId: '77777777-7777-4777-8777-777777777777',
      }),
    ).rejects.toBeInstanceOf(VisitAssessNotReadyError)

    expect(upsertVisitRisk).not.toHaveBeenCalled()
    expect(loadSessionShadowEvidence).not.toHaveBeenCalled()
  })

  it('propagates upsertVisitRisk failures so the worker can retry', async () => {
    loadSessionShadowEvidence.mockResolvedValue(evidenceFixture())
    query
      .mockResolvedValueOnce({
        json: async () => ({
          data: [{ fingerprint: 'fp', client_ip_hash: 'ip' }],
        }),
      })
      .mockResolvedValueOnce({
        json: async () => ({
          data: [{ arrivals: 1, low_engagement: 0 }],
        }),
      })
    upsertVisitRisk.mockRejectedValue(new Error('insert failed'))

    await expect(
      ensureSessionVisitAssessment({
        workspaceId: '11111111-1111-4111-8111-111111111111',
        sessionId: 'session-abcdefgh',
      }),
    ).rejects.toThrow('insert failed')
  })

  it('reports whether a session event exists in ClickHouse', async () => {
    query.mockResolvedValueOnce({
      json: async () => ({ data: [{ ok: 1 }] }),
    })
    await expect(
      isSessionEventPersisted({
        workspaceId: '11111111-1111-4111-8111-111111111111',
        sessionId: 'session-abcdefgh',
        eventId: '99999999-9999-4999-8999-999999999999',
      }),
    ).resolves.toBe(true)

    query.mockResolvedValueOnce({
      json: async () => ({ data: [] }),
    })
    await expect(
      isSessionEventPersisted({
        workspaceId: '11111111-1111-4111-8111-111111111111',
        sessionId: 'session-abcdefgh',
        eventId: '99999999-9999-4999-8999-999999999999',
      }),
    ).resolves.toBe(false)
  })
})
