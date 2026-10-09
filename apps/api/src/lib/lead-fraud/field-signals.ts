import {
  normalizeLeadFields,
  pickLeadEmail,
  pickLeadZip,
  pickTrustedFormUrl,
} from '../lead-fields.js'
import { decryptFieldBlob } from '../field-blob.js'
import { emailDomain } from './disposable-domains.js'
import { emptyFeatures } from './features.js'
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
}

export type LeadVelocityMaps = {
  fpSessions: Map<string, number>
  fpSubmits: Map<string, number>
  ipSubmits: Map<string, number>
  domainSubmits: Map<string, number>
}

export function isTruthyFlag(value: unknown): boolean {
  return value === true || value === 1 || value === '1'
}

export function extractRawFieldMap(raw: string): Record<string, string> {
  try {
    const parsed = JSON.parse(raw) as unknown
    if (!parsed || typeof parsed !== 'object') return {}
    const props = parsed as Record<string, unknown>
    const blob = props._k
    if (typeof blob === 'string' && blob.length > 0) {
      const decrypted = decryptFieldBlob(blob)
      if (decrypted) return decrypted
    }
    const source =
      props.fields &&
      typeof props.fields === 'object' &&
      !Array.isArray(props.fields)
        ? (props.fields as Record<string, unknown>)
        : props
    const out: Record<string, string> = {}
    for (const [k, v] of Object.entries(source)) {
      if (k === 'fields' || k === '_k') continue
      if (
        typeof v === 'string' ||
        typeof v === 'number' ||
        typeof v === 'boolean'
      ) {
        out[k] = String(v)
      }
    }
    return out
  } catch {
    return {}
  }
}

function velocityKey(workspaceId: string, value: string): string {
  return `${workspaceId}:${value}`
}

/**
 * Field-signal features shared by Warehouse and Data Leads.
 * FI behavior is not loaded here (too expensive at warehouse scale); submit
 * stubs avoid false "no typing / no interaction" penalties when FI is absent.
 */
export function buildFeaturesFromLeadSessionSignal(
  row: LeadSessionSignalRow,
  velocity: LeadVelocityMaps,
): LeadFraudFeatures {
  const rawFields = extractRawFieldMap(row.props || '{}')
  const fields = normalizeLeadFields(rawFields)
  const email = pickLeadEmail(fields)
  const zip = (row.zipVal || pickLeadZip(fields) || '').trim()
  const fingerprint = (row.fingerprint || '').trim()
  const ipHash = (row.clientIpHash || '').trim()
  const domain = emailDomain(email)
  const formSubmitted = row.formSubmitted
  const wid = row.workspaceId

  return emptyFeatures({
    fingerprint,
    browser: (row.browser || '').trim(),
    formSubmitted,
    email,
    firstName: (fields.first_name || '').trim(),
    lastName: (fields.last_name || '').trim(),
    zip,
    geoZip: (row.geoZip || '').trim(),
    stateField: (fields.state || '').trim(),
    geoState: (row.geoState || '').trim(),
    trustedFormUrl: pickTrustedFormUrl(rawFields),
    clientIpHash: ipHash,
    hasFormStarted: formSubmitted,
    hasFieldInteraction: formSubmitted || Boolean(email || zip),
    fillDurationMs: null,
    typedCount: formSubmitted ? 1 : 0,
    pasteCount: 0,
    pastedEmail: false,
    pastedName: false,
    pastedPhone: false,
    fingerprintSessionsSameDay: fingerprint
      ? (velocity.fpSessions.get(velocityKey(wid, fingerprint)) ?? 0)
      : 0,
    fingerprintSubmits24h: fingerprint
      ? (velocity.fpSubmits.get(velocityKey(wid, fingerprint)) ?? 0)
      : 0,
    ipHashSubmits24h: ipHash
      ? (velocity.ipSubmits.get(velocityKey(wid, ipHash)) ?? 0)
      : 0,
    emailDomainSubmits24h: domain
      ? (velocity.domainSubmits.get(velocityKey(wid, domain)) ?? 0)
      : 0,
    fieldCount: Object.keys(fields).length + (email ? 1 : 0) + (zip ? 1 : 0),
  })
}

export function computeLeadVelocityMaps(
  rows: LeadSessionSignalRow[],
): LeadVelocityMaps {
  const fpSessions = new Map<string, number>()
  const fpSubmits = new Map<string, number>()
  const ipSubmits = new Map<string, number>()
  const domainSubmits = new Map<string, number>()

  for (const row of rows) {
    const wid = row.workspaceId
    const fp = (row.fingerprint || '').trim()
    const ip = (row.clientIpHash || '').trim()
    if (fp) {
      const key = velocityKey(wid, fp)
      fpSessions.set(key, (fpSessions.get(key) ?? 0) + 1)
    }
    if (!row.formSubmitted) continue
    if (fp) {
      const key = velocityKey(wid, fp)
      fpSubmits.set(key, (fpSubmits.get(key) ?? 0) + 1)
    }
    if (ip) {
      const key = velocityKey(wid, ip)
      ipSubmits.set(key, (ipSubmits.get(key) ?? 0) + 1)
    }
    const email = pickLeadEmail(
      normalizeLeadFields(extractRawFieldMap(row.props || '{}')),
    )
    const domain = emailDomain(email)
    if (domain) {
      const key = velocityKey(wid, domain)
      domainSubmits.set(key, (domainSubmits.get(key) ?? 0) + 1)
    }
  }

  return { fpSessions, fpSubmits, ipSubmits, domainSubmits }
}
