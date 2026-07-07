import { createHash, randomBytes, timingSafeEqual } from 'node:crypto'

export const WORKSPACE_API_KEY_PREFIX = 'arohaa_live_'

export type GeneratedWorkspaceApiKey = {
  key: string
  prefix: string
  hash: string
}

export function hashWorkspaceApiKey(key: string): string {
  return createHash('sha256').update(key).digest('hex')
}

export function generateWorkspaceApiKey(): GeneratedWorkspaceApiKey {
  const secret = randomBytes(24).toString('base64url')
  const key = `${WORKSPACE_API_KEY_PREFIX}${secret}`
  return {
    key,
    prefix: key.slice(0, 20),
    hash: hashWorkspaceApiKey(key),
  }
}

export function isWorkspaceApiKeyFormat(value: string): boolean {
  return value.startsWith(WORKSPACE_API_KEY_PREFIX) && value.length > WORKSPACE_API_KEY_PREFIX.length + 16
}

export function verifyWorkspaceApiKeyHash(
  key: string,
  storedHash: string,
): boolean {
  const computed = hashWorkspaceApiKey(key)
  const a = Buffer.from(computed, 'utf8')
  const b = Buffer.from(storedHash, 'utf8')
  if (a.length !== b.length) return false
  return timingSafeEqual(a, b)
}
