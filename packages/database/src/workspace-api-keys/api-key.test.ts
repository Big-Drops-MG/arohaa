import { describe, expect, it } from 'vitest'
import {
  generateWorkspaceApiKey,
  hashWorkspaceApiKey,
  isWorkspaceApiKeyFormat,
  verifyWorkspaceApiKeyHash,
  WORKSPACE_API_KEY_PREFIX,
} from './api-key.js'

describe('workspace api keys', () => {
  it('generates keys with expected prefix', () => {
    const generated = generateWorkspaceApiKey()
    expect(generated.key.startsWith(WORKSPACE_API_KEY_PREFIX)).toBe(true)
    expect(generated.prefix).toBe(generated.key.slice(0, 20))
    expect(generated.hash).toBe(hashWorkspaceApiKey(generated.key))
  })

  it('verifies matching hashes only', () => {
    const generated = generateWorkspaceApiKey()
    expect(verifyWorkspaceApiKeyHash(generated.key, generated.hash)).toBe(true)
    expect(
      verifyWorkspaceApiKeyHash(`${generated.key}x`, generated.hash),
    ).toBe(false)
  })

  it('detects key format', () => {
    const generated = generateWorkspaceApiKey()
    expect(isWorkspaceApiKeyFormat(generated.key)).toBe(true)
    expect(isWorkspaceApiKeyFormat('not-a-key')).toBe(false)
  })
})
