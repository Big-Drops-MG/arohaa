import { describe, expect, it } from 'vitest'
import { isClickHouseAuthError } from './clickhouse.service.js'

describe('isClickHouseAuthError', () => {
  it('recognizes authentication failures', () => {
    expect(
      isClickHouseAuthError(
        new Error('Authentication failed: password is incorrect'),
      ),
    ).toBe(true)
    expect(isClickHouseAuthError(new Error('Code: 516. DB::Exception'))).toBe(
      true,
    )
    expect(isClickHouseAuthError(new Error('fetch failed'))).toBe(false)
  })
})
