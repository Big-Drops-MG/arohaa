import { OPAQUE_PROP_KEY, isPhoneFieldKey } from './field-blob.js'

export function propsSafeForThirdParty(
  props: Record<string, unknown> | null | undefined,
): Record<string, unknown> {
  if (!props || typeof props !== 'object') return {}
  const out: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(props)) {
    if (key === OPAQUE_PROP_KEY || key === 'fields') continue
    if (isPhoneFieldKey(key)) continue
    out[key] = value
  }
  return out
}

export function propertiesJsonSafeForThirdParty(propertiesJson: string): string {
  try {
    const parsed = JSON.parse(propertiesJson || '{}') as unknown
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return '{}'
    }
    return JSON.stringify(
      propsSafeForThirdParty(parsed as Record<string, unknown>),
    )
  } catch {
    return '{}'
  }
}
