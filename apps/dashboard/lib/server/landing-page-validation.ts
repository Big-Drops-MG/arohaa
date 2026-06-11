import type { OverviewLandingFormType } from "@/features/overview/model/overview"

const NOTES_MAX_LENGTH = 2000

export function parseOptionalFaviconUrl(
  raw: string
): { ok: true; value: string | null } | { ok: false; error: string } {
  const t = raw.trim()
  if (t.length === 0) return { ok: true, value: null }

  let u: URL
  try {
    u = new URL(t)
  } catch {
    return { ok: false, error: "Invalid favicon URL" }
  }

  if (u.protocol !== "http:" && u.protocol !== "https:") {
    return { ok: false, error: "Favicon URL must use http or https" }
  }

  return { ok: true, value: u.href }
}

export function parseLandingPageFormType(
  raw: unknown
): { ok: true; value: OverviewLandingFormType } | { ok: false; error: string } {
  const normalized = String(raw).trim().toLowerCase()
  if (
    normalized !== "zip" &&
    normalized !== "multiple" &&
    normalized !== "single"
  ) {
    return { ok: false, error: "Invalid formType" }
  }
  return { ok: true, value: normalized }
}

export function parseOptionalNotes(
  raw: unknown
): { ok: true; value: string | null } | { ok: false; error: string } {
  if (raw === undefined) {
    return { ok: false, error: "notes field missing" }
  }

  const t = String(raw).trim()
  if (t.length === 0) return { ok: true, value: null }
  if (t.length > NOTES_MAX_LENGTH) {
    return {
      ok: false,
      error: `Notes must be at most ${NOTES_MAX_LENGTH} characters`,
    }
  }

  return { ok: true, value: t }
}
