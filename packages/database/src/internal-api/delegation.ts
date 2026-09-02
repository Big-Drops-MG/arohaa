import { createHmac, randomUUID, timingSafeEqual } from 'node:crypto'

export const FUNNEL_LEADS_DELEGATION_SCOPE = 'funnel-leads' as const
export const DELEGATION_PAYLOAD_VERSION = 'v1' as const

const DELEGATION_TTL_SECONDS = 120

export type InternalUserDelegationPayload = {
  userId: string
  landingPageId: string
  scope: string
  exp: number
  nonce: string
}

export function delegationPayloadCanonical(
  payload: InternalUserDelegationPayload,
): string {
  return [
    DELEGATION_PAYLOAD_VERSION,
    payload.userId,
    payload.landingPageId,
    payload.scope,
    String(payload.exp),
    payload.nonce,
  ].join('|')
}

export function buildInternalUserDelegationPayload(params: {
  userId: string
  landingPageId: string
  scope?: string
  nowMs?: number
  nonce?: string
}): InternalUserDelegationPayload {
  const nowMs = params.nowMs ?? Date.now()
  return {
    userId: params.userId,
    landingPageId: params.landingPageId,
    scope: params.scope ?? FUNNEL_LEADS_DELEGATION_SCOPE,
    exp: Math.floor(nowMs / 1000) + DELEGATION_TTL_SECONDS,
    nonce: params.nonce ?? randomUUID(),
  }
}

export function signInternalUserDelegation(
  secret: string,
  payload: InternalUserDelegationPayload,
): string {
  return createHmac('sha256', secret)
    .update(delegationPayloadCanonical(payload))
    .digest('hex')
}

export function verifyInternalUserDelegation(
  secret: string,
  payload: InternalUserDelegationPayload,
  signature: string,
  nowMs = Date.now(),
): boolean {
  if (!signature || payload.exp * 1000 < nowMs) return false
  const expected = signInternalUserDelegation(secret, payload)
  if (expected.length !== signature.length) return false
  return timingSafeEqual(Buffer.from(expected), Buffer.from(signature))
}

export const INTERNAL_DELEGATION_HEADERS = {
  userId: 'x-arohaa-delegated-user',
  landingPageId: 'x-arohaa-delegated-landing-page',
  scope: 'x-arohaa-delegated-scope',
  exp: 'x-arohaa-delegated-exp',
  nonce: 'x-arohaa-delegated-nonce',
  signature: 'x-arohaa-delegated-sig',
} as const

export function buildInternalUserDelegationHeaders(
  secret: string,
  params: { userId: string; landingPageId: string; scope?: string; nowMs?: number },
): Record<string, string> {
  const payload = buildInternalUserDelegationPayload(params)
  return {
    [INTERNAL_DELEGATION_HEADERS.userId]: payload.userId,
    [INTERNAL_DELEGATION_HEADERS.landingPageId]: payload.landingPageId,
    [INTERNAL_DELEGATION_HEADERS.scope]: payload.scope,
    [INTERNAL_DELEGATION_HEADERS.exp]: String(payload.exp),
    [INTERNAL_DELEGATION_HEADERS.nonce]: payload.nonce,
    [INTERNAL_DELEGATION_HEADERS.signature]: signInternalUserDelegation(
      secret,
      payload,
    ),
  }
}

export function parseInternalUserDelegationHeaders(
  headers: Record<string, string | string[] | undefined>,
): { payload: InternalUserDelegationPayload; signature: string } | null {
  const read = (name: string): string | null => {
    const raw = headers[name]
    const value = Array.isArray(raw) ? raw[0] : raw
    return typeof value === 'string' && value.trim() ? value.trim() : null
  }

  const userId = read(INTERNAL_DELEGATION_HEADERS.userId)
  const landingPageId = read(INTERNAL_DELEGATION_HEADERS.landingPageId)
  const scope = read(INTERNAL_DELEGATION_HEADERS.scope)
  const expRaw = read(INTERNAL_DELEGATION_HEADERS.exp)
  const nonce = read(INTERNAL_DELEGATION_HEADERS.nonce)
  const signature = read(INTERNAL_DELEGATION_HEADERS.signature)
  if (!userId || !landingPageId || !scope || !expRaw || !nonce || !signature) {
    return null
  }

  const exp = Number(expRaw)
  if (!Number.isFinite(exp) || exp <= 0) return null

  return {
    payload: { userId, landingPageId, scope, exp, nonce },
    signature,
  }
}
