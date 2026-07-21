import { describe, expect, it, beforeEach, afterEach } from 'vitest'
import { resolveApiVersion } from './api-version.js'

describe('resolveApiVersion', () => {
  const prev = {
    API_VERSION: process.env.API_VERSION,
    GIT_SHA: process.env.GIT_SHA,
    SOURCE_VERSION: process.env.SOURCE_VERSION,
    GITHUB_SHA: process.env.GITHUB_SHA,
  }

  beforeEach(() => {
    delete process.env.API_VERSION
    delete process.env.GIT_SHA
    delete process.env.SOURCE_VERSION
    delete process.env.GITHUB_SHA
  })

  afterEach(() => {
    for (const [key, value] of Object.entries(prev)) {
      if (value === undefined) delete process.env[key]
      else process.env[key] = value
    }
  })

  it('reads semver from package.json when env is unset', () => {
    const version = resolveApiVersion()
    expect(version).toMatch(/^\d+\.\d+\.\d+$/)
  })

  it('prefers API_VERSION override', () => {
    process.env.API_VERSION = '2.5.0'
    expect(resolveApiVersion()).toBe('2.5.0')
  })

  it('appends short git sha as build metadata', () => {
    process.env.API_VERSION = '1.4.2'
    process.env.GIT_SHA = 'abcdef0123456789'
    expect(resolveApiVersion()).toBe('1.4.2+abcdef0')
  })

  it('does not double-append sha when already present', () => {
    process.env.API_VERSION = '1.0.0+abcdef0'
    process.env.GIT_SHA = 'abcdef0123456789'
    expect(resolveApiVersion()).toBe('1.0.0+abcdef0')
  })
})
