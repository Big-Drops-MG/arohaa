import { sql, type SQL } from 'drizzle-orm'
import { experiments, type ExperimentVariantLink } from '../schema/experiments.js'

export const VARIANT_LABEL_MAX_LENGTH = 24

/** Labels offered by the dashboard when a variant is created, in order. */
export const VARIANT_LABEL_SEQUENCE = [
  'A',
  'B',
  'C',
  'D',
  'E',
  'F',
  'G',
  'H',
  'I',
  'J',
] as const

/**
 * Parses the JSONB `variants` column. Legacy rows stored plain strings, which
 * carry no landing page reference and are therefore dropped.
 */
export function normalizeExperimentVariantLinks(
  raw: unknown,
): ExperimentVariantLink[] {
  if (!Array.isArray(raw)) return []

  const out: ExperimentVariantLink[] = []
  for (const item of raw) {
    if (!item || typeof item !== 'object') continue
    const record = item as Record<string, unknown>
    const label = typeof record.label === 'string' ? record.label.trim() : ''
    const landingPageId =
      typeof record.landingPageId === 'string'
        ? record.landingPageId.trim()
        : ''
    if (!label || !landingPageId) continue
    out.push({ label, landingPageId })
  }
  return out
}

export function normalizeExperimentVariantLabel(
  raw: unknown,
): { ok: true; label: string } | { ok: false; error: string } {
  const collapsed = String(raw ?? '')
    .trim()
    .replace(/\s+/g, ' ')

  if (!collapsed) {
    return { ok: false, error: 'Variant label is required' }
  }
  if (collapsed.length > VARIANT_LABEL_MAX_LENGTH) {
    return {
      ok: false,
      error: `Variant label must be at most ${VARIANT_LABEL_MAX_LENGTH} characters`,
    }
  }
  if (!/^[A-Za-z0-9][A-Za-z0-9 _-]*$/.test(collapsed)) {
    return {
      ok: false,
      error:
        'Variant label may only contain letters, numbers, spaces, hyphens and underscores',
    }
  }

  return {
    ok: true,
    label: collapsed.length === 1 ? collapsed.toUpperCase() : collapsed,
  }
}

function labelKey(label: string): string {
  return label.trim().toLowerCase()
}

export function isVariantLabelTaken(
  label: string,
  takenLabels: Iterable<string>,
): boolean {
  const key = labelKey(label)
  for (const taken of takenLabels) {
    if (labelKey(taken) === key) return true
  }
  return false
}

/**
 * First label from {@link VARIANT_LABEL_SEQUENCE} that is still free, falling
 * back to a numeric suffix once the sequence is exhausted.
 */
export function nextAvailableVariantLabel(
  takenLabels: Iterable<string>,
): string {
  const taken = new Set<string>()
  for (const label of takenLabels) taken.add(labelKey(label))

  for (const candidate of VARIANT_LABEL_SEQUENCE) {
    if (!taken.has(labelKey(candidate))) return candidate
  }

  let index = taken.size + 1
  while (taken.has(labelKey(`V${index}`))) index += 1
  return `V${index}`
}

/**
 * Matches experiments whose `variants` array links the given landing page.
 * Lets a page that is only a member of somebody else's experiment resolve that
 * experiment, instead of only the hub row that owns `landingPageId`.
 */
export function experimentIncludesLandingPage(landingPageId: string): SQL {
  const probe = JSON.stringify([{ landingPageId }])
  return sql`${experiments.variants} @> ${probe}::jsonb`
}
