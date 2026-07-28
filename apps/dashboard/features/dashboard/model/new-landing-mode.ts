export const NEW_LANDING_PATH = "/dashboard/new-landing"

export type NewLandingMode = "landing" | "variant"

export function parseNewLandingMode(raw: unknown): NewLandingMode {
  return String(raw ?? "")
    .trim()
    .toLowerCase() === "variant"
    ? "variant"
    : "landing"
}

export function newVariantPath(parentPublicId?: string): string {
  const params = new URLSearchParams({ mode: "variant" })
  if (parentPublicId) params.set("parent", parentPublicId)
  return `${NEW_LANDING_PATH}?${params.toString()}`
}
