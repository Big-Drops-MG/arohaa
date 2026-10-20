import {
  normalizeLeadFields,
  pickLeadEmail,
  pickLeadZip,
  pickTrustedFormUrl,
} from '../lead-fields.js'
import { decryptFieldBlob, decryptJsonBlob } from '../field-blob.js'
import {
  FP_REUSE_DAY_THRESHOLD,
  VELOCITY_WINDOW_HOURS,
} from './constants.js'
import { emailDomain } from './disposable-domains.js'
import { emptyFeatures } from './features.js'
import type { FiBehaviorSummary } from './fi-batch.js'
import type { LeadFraudFeatures } from './types.js'

export type LeadSessionSignalRow = {
  workspaceId: string
  sessionId: string
  fingerprint: string
  browser: string
  geoZip: string
  geoState: string
  clientIpHash: string
  formSubmitted: boolean
  props: string
  zipVal: string
  submittedAtMs: number
  tenantWorkspaceId?: string
  phoneHash?: string
  emailHash?: string
  eventId?: string
  utmSource?: string
  utmS1?: string
  utmCampaign?: string
}

export type LeadVelocityMaps = {
  fpSessionTimes: Map<string, number[]>
  fpSubmitTimes: Map<string, number[]>
  ipSubmitTimes: Map<string, number[]>
  domainSubmitTimes: Map<string, number[]>
}

export function isTruthyFlag(value: unknown): boolean {
  return value === true || value === 1 || value === '1'
}

function isFiLogPayload(value: Record<string, unknown>): boolean {
  return Array.isArray(value.i) || Array.isArray(value.items)
}

function coerceStringFieldMap(
  source: Record<string, unknown>,
): Record<string, string> {
  const out: Record<string, string> = {}
  for (const [k, v] of Object.entries(source)) {
    if (k === 'fields' || k === '_k' || k === 'i' || k === 'items') continue
    if (
      typeof v === 'string' ||
      typeof v === 'number' ||
      typeof v === 'boolean'
    ) {
      out[k] = String(v)
    }
  }
  return out
}

export function extractRawFieldMap(raw: string): Record<string, string> {
  try {
    const parsed = JSON.parse(raw) as unknown
    if (!parsed || typeof parsed !== 'object') return {}
    const props = parsed as Record<string, unknown>
    const blob = props._k
    if (typeof blob === 'string' && blob.length > 0) {
      const asJson = decryptJsonBlob(blob)
      if (
        asJson &&
        typeof asJson === 'object' &&
        !Array.isArray(asJson) &&
        !isFiLogPayload(asJson as Record<string, unknown>)
      ) {
        const fromJson = coerceStringFieldMap(asJson as Record<string, unknown>)
        if (Object.keys(fromJson).length > 0) return fromJson
      }
      const decrypted = decryptFieldBlob(blob)
      if (decrypted && Object.keys(decrypted).length > 0) {
        const keys = Object.keys(decrypted)
        const fiScalarsOnly = keys.every(
          (k) => k === 'v' || k === 's' || k === 'f',
        )
        if (!fiScalarsOnly) return decrypted
      }
    }
    const source =
      props.fields &&
      typeof props.fields === 'object' &&
      !Array.isArray(props.fields)
        ? (props.fields as Record<string, unknown>)
        : props
    if (isFiLogPayload(source)) return {}
    return coerceStringFieldMap(source)
  } catch {
    return {}
  }
}

function velocityKey(workspaceId: string, value: string): string {
  return `${workspaceId}:${value}`
}

function pushTime(map: Map<string, number[]>, key: string, atMs: number): void {
  const list = map.get(key) ?? []
  list.push(atMs)
  map.set(key, list)
}

function countInWindow(
  times: number[] | undefined,
  centerMs: number,
  windowMs: number,
): number {
  if (!times || times.length === 0 || !Number.isFinite(centerMs)) return 0
  let n = 0
  for (const t of times) {
    if (Math.abs(t - centerMs) <= windowMs) n += 1
  }
  return n
}


export function buildFeaturesFromLeadSessionSignal(
  row: LeadSessionSignalRow,
  velocity: LeadVelocityMaps,
  fiBehavior?: FiBehaviorSummary | null,
): LeadFraudFeatures {
  const rawFields = extractRawFieldMap(row.props || '{}')
  const fields = normalizeLeadFields(rawFields)
  const email = pickLeadEmail(fields)
  const formZipEntered = pickLeadZip(fields).trim()
  const fingerprint = (row.fingerprint || '').trim()
  const ipHash = (row.clientIpHash || '').trim()
  const domain = emailDomain(email)
  const formSubmitted = row.formSubmitted
  const wid = row.workspaceId
  const centerMs = row.submittedAtMs > 0 ? row.submittedAtMs : Date.now()
  const dayMs = 24 * 60 * 60_000
  const windowMs = VELOCITY_WINDOW_HOURS * 60 * 60_000

  const fiKnown = Boolean(fiBehavior?.fiBehaviorKnown)
  const behavior = fiBehavior
    ? {
        fillDurationMs: fiBehavior.fillDurationMs,
        typedCount: fiBehavior.typedCount,
        pasteCount: fiBehavior.pasteCount,
        pastedEmail: fiBehavior.pastedEmail,
        pastedName: fiBehavior.pastedName,
        pastedPhone: fiBehavior.pastedPhone,
        hasFormStarted: fiBehavior.hasFormStarted,
        hasFieldInteraction: fiBehavior.hasFieldInteraction,
      }
    : {
        fillDurationMs: null,
        typedCount: 0,
        pasteCount: 0,
        pastedEmail: false,
        pastedName: false,
        pastedPhone: false,
        hasFormStarted: false,
        hasFieldInteraction: false,
      }

  return emptyFeatures({
    fingerprint,
    browser: (row.browser || '').trim(),
    formSubmitted,
    email,
    firstName: (fields.first_name || '').trim(),
    lastName: (fields.last_name || '').trim(),
    formZipEntered,
    zip: formZipEntered,
    geoZip: (row.geoZip || '').trim(),
    stateField: (fields.state || '').trim(),
    geoState: (row.geoState || '').trim(),
    trustedFormUrl: pickTrustedFormUrl(rawFields),
    clientIpHash: ipHash,
    ...behavior,
    fiBehaviorKnown: fiKnown,
    fingerprintSessionsSameDay: fingerprint
      ? countInWindow(
          velocity.fpSessionTimes.get(velocityKey(wid, fingerprint)),
          centerMs,
          dayMs,
        )
      : 0,
    fingerprintSubmits24h: fingerprint
      ? countInWindow(
          velocity.fpSubmitTimes.get(velocityKey(wid, fingerprint)),
          centerMs,
          windowMs,
        )
      : 0,
    ipHashSubmits24h: ipHash
      ? countInWindow(
          velocity.ipSubmitTimes.get(velocityKey(wid, ipHash)),
          centerMs,
          windowMs,
        )
      : 0,
    emailDomainSubmits24h: domain
      ? countInWindow(
          velocity.domainSubmitTimes.get(velocityKey(wid, domain)),
          centerMs,
          windowMs,
        )
      : 0,
    fieldCount:
      Object.keys(fields).length + (email ? 1 : 0) + (formZipEntered ? 1 : 0),
    velocityWindowKnown: true,
  })
}

export function computeLeadVelocityMaps(
  rows: LeadSessionSignalRow[],
): LeadVelocityMaps {
  const fpSessionTimes = new Map<string, number[]>()
  const fpSubmitTimes = new Map<string, number[]>()
  const ipSubmitTimes = new Map<string, number[]>()
  const domainSubmitTimes = new Map<string, number[]>()

  for (const row of rows) {
    const wid = row.workspaceId
    const at =
      row.submittedAtMs > 0 && Number.isFinite(row.submittedAtMs)
        ? row.submittedAtMs
        : Date.now()
    const fp = (row.fingerprint || '').trim()
    const ip = (row.clientIpHash || '').trim()
    if (fp) {
      pushTime(fpSessionTimes, velocityKey(wid, fp), at)
    }
    if (!row.formSubmitted) continue
    if (fp) {
      pushTime(fpSubmitTimes, velocityKey(wid, fp), at)
    }
    if (ip) {
      pushTime(ipSubmitTimes, velocityKey(wid, ip), at)
    }
    const email = pickLeadEmail(
      normalizeLeadFields(extractRawFieldMap(row.props || '{}')),
    )
    const domain = emailDomain(email)
    if (domain) {
      pushTime(domainSubmitTimes, velocityKey(wid, domain), at)
    }
  }

  void FP_REUSE_DAY_THRESHOLD

  return {
    fpSessionTimes,
    fpSubmitTimes,
    ipSubmitTimes,
    domainSubmitTimes,
  }
}
