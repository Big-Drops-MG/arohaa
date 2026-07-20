import { describe, expect, it } from 'vitest'
import { isClickHouseUnavailableError } from './is-clickhouse-unavailable.js'

describe('isClickHouseUnavailableError', () => {
  it('treats DNS failures as unavailable', () => {
    expect(
      isClickHouseUnavailableError(
        Object.assign(new Error('getaddrinfo ENOTFOUND example.clickhouse.cloud'), {
          code: 'ENOTFOUND',
        }),
      ),
    ).toBe(true)
  })

  it('treats nested ClickHouse client connection errors as unavailable', () => {
    const cause = Object.assign(new Error('getaddrinfo ENOTFOUND host'), {
      code: 'ENOTFOUND',
    })
    expect(
      isClickHouseUnavailableError(
        Object.assign(new Error('HTTP request error.'), { cause }),
      ),
    ).toBe(true)
  })

  it('does not treat unrelated errors as unavailable', () => {
    expect(isClickHouseUnavailableError(new Error('division by zero'))).toBe(
      false,
    )
    expect(isClickHouseUnavailableError(null)).toBe(false)
  })
})
