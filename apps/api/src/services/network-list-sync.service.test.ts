import { describe, expect, it } from 'vitest'
import { __networkListSyncTest } from './network-list-sync.service.js'

describe('network list sync helpers', () => {
  it('normalizes IP and CIDR lines', () => {
    expect(__networkListSyncTest.normalizeCidrLine('1.2.3.4', 'ip')).toBe(
      '1.2.3.4/32',
    )
    expect(
      __networkListSyncTest.normalizeCidrLine('203.0.113.0/24', 'cidr'),
    ).toBe('203.0.113.0/24')
    expect(__networkListSyncTest.normalizeCidrLine('# comment', 'cidr')).toBe(
      null,
    )
  })

  it('aggregates internal bad IPs into /32 and hot /24 subnets', () => {
    const result = __networkListSyncTest.aggregateInternalBadCidrs(
      [
        '203.0.113.10',
        '203.0.113.11',
        '203.0.113.12',
        '198.51.100.1',
        '10.0.0.1',
      ],
      { subnetMinHits: 3 },
    )
    expect(result.hostCidrs).toEqual(
      expect.arrayContaining(['203.0.113.10/32', '198.51.100.1/32']),
    )
    expect(result.hostCidrs).not.toContain('10.0.0.1/32')
    expect(result.subnetCidrs).toContain('203.0.113.0/24')
    expect(result.subnetCidrs).not.toContain('198.51.100.0/24')
  })

  it('maps IPv4 to /24', () => {
    expect(__networkListSyncTest.ipv4ToSlash24('203.0.113.44')).toBe(
      '203.0.113.0/24',
    )
  })
})
