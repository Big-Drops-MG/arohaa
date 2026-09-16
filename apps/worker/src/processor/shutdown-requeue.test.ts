import { describe, expect, it, vi } from 'vitest'
import { requeueInFlight, takeInFlightPayload } from './shutdown-requeue.js'

describe('takeInFlightPayload (SR21)', () => {
  it('returns the payload once and clears the slot', () => {
    const slot = { current: '{"ev":"page_view"}' }
    expect(takeInFlightPayload(slot)).toBe('{"ev":"page_view"}')
    expect(slot.current).toBeNull()
    expect(takeInFlightPayload(slot)).toBeNull()
  })
})

describe('requeueInFlight (SR21)', () => {
  it('no-ops when payload is empty (does not touch Redis)', async () => {
    const redis = { lpush: vi.fn() }
    const result = await requeueInFlight(redis, 'analytics_queue', null)
    expect(result).toEqual({ action: 'noop' })
    expect(redis.lpush).not.toHaveBeenCalled()
  })

  it('LPUSHes the payload back onto the source queue', async () => {
    const redis = { lpush: vi.fn().mockResolvedValue(1) }
    const payload = JSON.stringify({ event_id: 'test-only-not-prod' })
    const result = await requeueInFlight(redis, 'analytics_queue', payload, {
      info: vi.fn(),
      error: vi.fn(),
    })
    expect(result).toEqual({ action: 'requeued', queue: 'analytics_queue' })
    expect(redis.lpush).toHaveBeenCalledWith('analytics_queue', payload)
  })

  it('falls back to failed_events DLQ if main requeue fails', async () => {
    const redis = {
      lpush: vi
        .fn()
        .mockRejectedValueOnce(new Error('redis down'))
        .mockResolvedValueOnce(1),
    }
    const payload = '{"x":1}'
    const result = await requeueInFlight(redis, 'heatmap_queue', payload, {
      info: vi.fn(),
      error: vi.fn(),
    })
    expect(result).toEqual({ action: 'dlq', queue: 'heatmap_queue' })
    expect(redis.lpush).toHaveBeenNthCalledWith(1, 'heatmap_queue', payload)
    expect(redis.lpush).toHaveBeenNthCalledWith(
      2,
      'failed_events',
      expect.stringContaining('shutdown_requeue_failed'),
    )
  })
})
