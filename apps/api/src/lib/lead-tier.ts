import { decryptFieldBlob, OPAQUE_PROP_KEY } from './field-blob.js'
import { normalizeLeadFields } from './lead-fields.js'
import {
  leadMatchesQualityAttribute,
  type LeadQualityAttributeId,
} from './lead-quality.js'

export type LeadTier = 'premium' | 'standard'

export const PREMIUM_LEAD_CRITERIA: readonly LeadQualityAttributeId[] = [
  'homeowner',
  'currentlyInsured',
  'multiVehicle',
]

const LEAD_TIER_EVENT_NAMES = new Set([
  'form_success',
  'form_submit',
  'form_step_complete',
  'form_step_view',
])

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

export function resolveLeadTier(
  stored: unknown,
  fields: Record<string, string>,
): LeadTier {
  return isLeadTier(stored) ? stored : classifyLeadTier(fields)
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
  if (!LEAD_TIER_EVENT_NAMES.has(eventName) || !props) return ''
  const blob = props[OPAQUE_PROP_KEY]
  const fromBlob =
    typeof blob === 'string' && blob.length > 0
      ? (decryptFieldBlob(blob) ?? {})
      : {}
  const raw = { ...fromBlob, ...scalarFieldMap(props.fields) }
  if (Object.keys(raw).length === 0) return ''
  return classifyLeadTier(normalizeLeadFields(raw))
}
