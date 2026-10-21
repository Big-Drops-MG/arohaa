import { describe, expect, it, beforeEach } from 'vitest'
import {
  __networkClassifyTest,
  classifyNetworkSync,
  getNetworkDatasetHealth,
} from './network-classify.service.js'

describe('network classify', () => {
  beforeEach(() => {
    __networkClassifyTest.resetCache()
  })

  it('parses IPv4 and IPv6 CIDRs', () => {
    const v4 = __networkClassifyTest.parseCidr('203.0.113.0/24')
    const v6 = __networkClassifyTest.parseCidr('2001:db8::/32')
    expect(v4?.version).toBe(4)
    expect(v6?.version).toBe(6)
  })

  it('matches IPv6 proxy CIDRs when present', () => {
    const cidr = __networkClassifyTest.parseCidr('2001:db8::/32')
    expect(cidr).not.toBeNull()
    expect(
      __networkClassifyTest.ipInProxyList('2001:db8::1', cidr ? [cidr] : []),
    ).toBe(true)
    expect(
      __networkClassifyTest.ipInProxyList('2001:db9::1', cidr ? [cidr] : []),
    ).toBe(false)
  })

  it('returns unavailable for private addresses', () => {
    const result = classifyNetworkSync('127.0.0.1')
    expect(result.networkClass).toBe('unavailable')
  })

  it('exposes dataset health without claiming no-proxy on empty lists', () => {
    const health = getNetworkDatasetHealth()
    expect(health).toHaveProperty('proxyListStatus')
    expect(health).toHaveProperty('hostingAsnStatus')
    expect(health).toHaveProperty('asnDbStatus')
    if (health.proxyListStatus === 'empty') {
      const classified = classifyNetworkSync('8.8.8.8')
      expect(classified.networkClass).not.toBe('known_proxy_list')
    }
  })

  it('treats missing asOf as expired', () => {
    expect(__networkClassifyTest.isExpired('', 90)).toBe(true)
    expect(__networkClassifyTest.isExpired('2099-01-01', 90)).toBe(false)
  })
})
