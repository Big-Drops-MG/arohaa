export const LANDING_PAGE_CHANNEL_TYPES = [
  { id: "email", label: "Email" },
  { id: "social", label: "Social" },
] as const

export type LandingPageChannelType =
  (typeof LANDING_PAGE_CHANNEL_TYPES)[number]["id"]

const CHANNEL_TYPE_SET = new Set<string>(
  LANDING_PAGE_CHANNEL_TYPES.map((option) => option.id)
)

export function isLandingPageChannelType(
  value: unknown
): value is LandingPageChannelType {
  return typeof value === "string" && CHANNEL_TYPE_SET.has(value)
}

/**
 * Reads optional single channel type. Supports legacy `channelTypes` arrays
 * (first valid entry wins).
 */
export function parseLandingPageChannelType(
  metadata: Record<string, unknown> | null | undefined
): LandingPageChannelType | null {
  if (!metadata) return null

  if (isLandingPageChannelType(metadata.channelType)) {
    return metadata.channelType
  }

  const legacy = metadata.channelTypes
  if (Array.isArray(legacy)) {
    for (const item of legacy) {
      if (isLandingPageChannelType(item)) return item
    }
  }

  return null
}

export function normalizeLandingPageChannelTypeInput(
  raw: unknown
):
  | { ok: true; value: LandingPageChannelType | null }
  | { ok: false; error: string } {
  if (raw === undefined) {
    return { ok: false, error: "channelType field missing" }
  }
  if (raw === null || raw === "") {
    return { ok: true, value: null }
  }
  if (isLandingPageChannelType(raw)) {
    return { ok: true, value: raw }
  }
  // Accept a single-item array for older clients briefly.
  if (Array.isArray(raw)) {
    if (raw.length === 0) return { ok: true, value: null }
    if (raw.length === 1 && isLandingPageChannelType(raw[0])) {
      return { ok: true, value: raw[0] }
    }
    return {
      ok: false,
      error: "channelType must be email, social, or null",
    }
  }
  return {
    ok: false,
    error: "channelType must be email, social, or null",
  }
}

export function mergeChannelTypeIntoMetadata(
  existing: Record<string, unknown> | null | undefined,
  channelType: LandingPageChannelType | null
): Record<string, unknown> {
  const base = { ...(existing ?? {}) }
  delete base.channelTypes
  if (channelType == null) {
    delete base.channelType
  } else {
    base.channelType = channelType
  }
  return base
}

export function channelTypeLabel(type: LandingPageChannelType): string {
  return (
    LANDING_PAGE_CHANNEL_TYPES.find((option) => option.id === type)?.label ??
    type
  )
}
