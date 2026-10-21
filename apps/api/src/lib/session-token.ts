import { createHmac, timingSafeEqual } from 'node:crypto'

const DEFAULT_TTL_MS = 30 * 60_000
const MAX_TTL_MS = 60 * 60_000

export type SessionTokenClaims = {
  wid: string
  lpId: string
  sid: string
  uid: string
  iat: number
  exp: number
}

export type SessionTokenSecretStatus =
  | { ok: true; secret: string }
  | { ok: false; reason: 'missing' }

export function resolveSessionTokenSecret(): SessionTokenSecretStatus {
  const dedicated = process.env.SESSION_TOKEN_SECRET?.trim()
  if (dedicated) return { ok: true, secret: dedicated }

  const isProd = process.env.NODE_ENV === 'production'
  if (isProd) {
    return { ok: false, reason: 'missing' }
  }

  const devFallback =
    process.env.FIELD_BLOB_KEY?.trim() ||
    process.env.CONTACT_HASH_SECRET?.trim() ||
    process.env.AROHAA_INTERNAL_API_SECRET?.trim()
  if (devFallback) return { ok: true, secret: devFallback }

  return { ok: false, reason: 'missing' }
}

function b64url(input: Buffer | string): string {
  const buf = typeof input === 'string' ? Buffer.from(input, 'utf8') : input
  return buf
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '')
}

function fromB64url(value: string): Buffer {
  const padded = value.replace(/-/g, '+').replace(/_/g, '/')
  const pad = padded.length % 4 === 0 ? '' : '='.repeat(4 - (padded.length % 4))
  return Buffer.from(padded + pad, 'base64')
}

function sign(payloadB64: string, secret: string): string {
  return b64url(createHmac('sha256', secret).update(payloadB64).digest())
}

export function issueSessionToken(input: {
  wid: string
  lpId?: string
  sid: string
  uid: string
  ttlMs?: number
}):
  | { ok: true; token: string; expiresAt: number; claims: SessionTokenClaims }
  | { ok: false; reason: 'secret_unavailable' } {
  const secret = resolveSessionTokenSecret()
  if (!secret.ok) return { ok: false, reason: 'secret_unavailable' }

  const now = Date.now()
  const ttl = Math.min(
    Math.max(input.ttlMs ?? DEFAULT_TTL_MS, 60_000),
    MAX_TTL_MS,
  )
  const claims: SessionTokenClaims = {
    wid: input.wid.trim(),
    lpId: (input.lpId ?? '').trim(),
    sid: input.sid.trim(),
    uid: input.uid.trim(),
    iat: now,
    exp: now + ttl,
  }
  const payloadB64 = b64url(JSON.stringify(claims))
  const token = `${payloadB64}.${sign(payloadB64, secret.secret)}`
  return { ok: true, token, expiresAt: claims.exp, claims }
}

export type SessionTokenCheck =
  | { status: 'ok'; claims: SessionTokenClaims }
  | { status: 'missing' }
  | { status: 'invalid' }
  | { status: 'expired'; claims: SessionTokenClaims }
  | { status: 'unavailable' }
  | {
      status: 'mismatch'
      claims: SessionTokenClaims
      field: 'wid' | 'lp_id' | 'sid'
    }

export function verifySessionToken(
  token: string | undefined | null,
  expected: { wid: string; lpId?: string; sid: string },
): SessionTokenCheck {
  const secret = resolveSessionTokenSecret()
  if (!secret.ok) return { status: 'unavailable' }

  const raw = typeof token === 'string' ? token.trim() : ''
  if (!raw) return { status: 'missing' }
  const parts = raw.split('.')
  if (parts.length !== 2 || !parts[0] || !parts[1]) {
    return { status: 'invalid' }
  }
  const [payloadB64, sig] = parts
  const expectedSig = sign(payloadB64, secret.secret)
  try {
    const a = Buffer.from(sig)
    const b = Buffer.from(expectedSig)
    if (a.length !== b.length || !timingSafeEqual(a, b)) {
      return { status: 'invalid' }
    }
  } catch {
    return { status: 'invalid' }
  }

  let claims: SessionTokenClaims
  try {
    claims = JSON.parse(fromB64url(payloadB64).toString('utf8')) as SessionTokenClaims
  } catch {
    return { status: 'invalid' }
  }
  if (
    !claims ||
    typeof claims.wid !== 'string' ||
    typeof claims.sid !== 'string' ||
    typeof claims.exp !== 'number'
  ) {
    return { status: 'invalid' }
  }
  if (claims.exp <= Date.now()) {
    return { status: 'expired', claims }
  }
  if (claims.wid !== expected.wid.trim()) {
    return { status: 'mismatch', claims, field: 'wid' }
  }
  if (claims.sid !== expected.sid.trim()) {
    return { status: 'mismatch', claims, field: 'sid' }
  }
  const expectedLp = (expected.lpId ?? '').trim()
  if (expectedLp && claims.lpId && claims.lpId !== expectedLp) {
    return { status: 'mismatch', claims, field: 'lp_id' }
  }
  return { status: 'ok', claims }
}
