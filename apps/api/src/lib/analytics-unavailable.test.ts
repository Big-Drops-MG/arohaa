import { describe, expect, it } from 'vitest'
import { isClickHouseUnavailableError } from './is-clickhouse-unavailable.js'
import {
  ANALYTICS_UNAVAILABLE_BODY,
  ANALYTICS_UNAVAILABLE_STATUS,
} from './analytics-unavailable.js'

describe('analytics unavailable contract (SR25)', () => {
  it('uses 503 with a stable error body (not empty zeros)', () => {
    expect(ANALYTICS_UNAVAILABLE_STATUS).toBe(503)
    expect(ANALYTICS_UNAVAILABLE_BODY).toEqual({
      error: 'analytics_unavailable',
      code: 'CLICKHOUSE_DOWN',
    })
  })

  it('maps ClickHouse transport failures to the unavailable path', () => {
    expect(
      isClickHouseUnavailableError(
        Object.assign(new Error('ClickHouse request failed'), {
          code: 'ECONNREFUSED',
        }),
      ),
    ).toBe(true)
  })

  it('does not treat query logic bugs as outages', () => {
    expect(isClickHouseUnavailableError(new Error('invalid column'))).toBe(
      false,
    )
  })
})
