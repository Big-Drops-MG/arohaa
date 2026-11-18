import { decryptFieldBlob, OPAQUE_PROP_KEY } from './field-blob.js'
import { LEAD_FRAUD_THRESHOLDS } from './lead-fraud/constants.js'
import { normalizeLeadFields } from './lead-fields.js'
import {
  leadMatchesQualityAttribute,
  type LeadQualityAttributeId,
} from './lead-quality.js'

export type LeadTier = 'premium' | 'standard'

export type LeadTierTrustInput = {
  scoreAvailable?: boolean
  effectiveLabel?: string | null
  label?: string | null
  score?: number | null
}

export type ResolveLeadTierOptions = {
  fraud?: LeadTierTrustInput | null
  formSubmitted?: boolean
}

export const PREMIUM_LEAD_CRITERIA: readonly LeadQualityAttributeId[] = [
  'homeowner',
  'currentlyInsured',
  'multiVehicle',
]

const LEAD_TIER_SUBMIT_EVENTS = new Set(['form_success', 'form_submit'])

export function isLeadTier(value: unknown): value is LeadTier {
  return value === 'premium' || value === 'standard'
}

export function classifyLeadTier(fields: Record<string, string>): LeadTier {
  const lead = { utmSource: '', fields }
  return PREMIUM_LEAD_CRITERIA.every((id) =>
    leadMatchesQualityAttribute(lead, id),
  )
    ? 'premium'
    : 'standard'
}

export function passesLeadTierTrustGate(
  fraud?: LeadTierTrustInput | null,
): boolean {
  if (!fraud) return true
  if (fraud.scoreAvailable === false) return true
  const label = String(fraud.effectiveLabel || fraud.label || '').trim()
  if (label === 'fraud') return false
  if (
    typeof fraud.score === 'number' &&
    Number.isFinite(fraud.score) &&
    fraud.score < LEAD_FRAUD_THRESHOLDS.fraudBelowTrust
  ) {
    return false
  }
  return true
}

export function resolveLeadTier(
  stored: unknown,
  fields: Record<string, string>,
  options?: ResolveLeadTierOptions | LeadTierTrustInput | null,
): LeadTier {
  const opts = normalizeResolveOptions(options)
  if (opts.formSubmitted === false) return 'standard'

  const profile = isLeadTier(stored) ? stored : classifyLeadTier(fields)
  if (profile === 'premium' && !passesLeadTierTrustGate(opts.fraud)) {
    return 'standard'
  }
  return profile
}

function normalizeResolveOptions(
  options?: ResolveLeadTierOptions | LeadTierTrustInput | null,
): ResolveLeadTierOptions {
  if (!options) return {}
  if (
    'fraud' in options ||
    'formSubmitted' in options
  ) {
    return options as ResolveLeadTierOptions
  }
  return { fraud: options as LeadTierTrustInput }
}

function scalarFieldMap(source: unknown): Record<string, string> {
  if (!source || typeof source !== 'object' || Array.isArray(source)) return {}
  const out: Record<string, string> = {}
  for (const [key, value] of Object.entries(source as Record<string, unknown>)) {
    if (
      typeof value === 'string' ||
      typeof value === 'number' ||
      typeof value === 'boolean'
    ) {
      out[key] = String(value)
    }
  }
  return out
}

export function leadTierForIngestEvent(
  eventName: string,
  props: Record<string, unknown> | undefined,
): LeadTier | '' {
  if (!LEAD_TIER_SUBMIT_EVENTS.has(eventName) || !props) return ''
  const blob = props[OPAQUE_PROP_KEY]
  const fromBlob =
    typeof blob === 'string' && blob.length > 0
      ? (decryptFieldBlob(blob) ?? {})
      : {}
  const raw = { ...fromBlob, ...scalarFieldMap(props.fields) }
  if (Object.keys(raw).length === 0) return ''
  return classifyLeadTier(normalizeLeadFields(raw))
}
