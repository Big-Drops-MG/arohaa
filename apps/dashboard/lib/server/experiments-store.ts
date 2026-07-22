import { and, asc, eq, inArray, isNull, ne } from "drizzle-orm"
import {
  db,
  experiments,
  landingPages,
  type ExperimentStatus,
  type ExperimentVariantLink,
} from "@workspace/database"
import type { LandingPageRow } from "@/lib/server/landing-pages-store"

export type ExperimentVariantHealth = {
  label: string
  landingPageId: string
  publicId: string
  brandName: string
  hostname: string
  landingPageUrl: string
  sdkInstallStatus: string
  lastEventAt: string | null
  isControl: boolean
  health: "ok" | "waiting" | "stale"
}

export type ExperimentConfigView = {
  id: string
  name: string
  status: string
  startDate: string
  endDate: string | null
  noEndDate: boolean
  controlLandingPageId: string | null
  variants: ExperimentVariantHealth[]
  variantLabels: string
}

export type SiblingLandingPageOption = {
  id: string
  publicId: string
  brandName: string
  hostname: string
  landingPageUrl: string
}

const STALE_MS = 7 * 24 * 60 * 60 * 1000

function toDateKey(date: Date): string {
  return date.toISOString().slice(0, 10)
}

function parseDateKey(value: string): Date | null {
  const trimmed = value.trim()
  if (!/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return null
  const date = new Date(`${trimmed}T00:00:00.000Z`)
  return Number.isNaN(date.getTime()) ? null : date
}

export function normalizeExperimentVariants(
  raw: unknown
): ExperimentVariantLink[] {
  if (!Array.isArray(raw)) return []
  const out: ExperimentVariantLink[] = []
  for (const item of raw) {
    if (typeof item === "string") {
      const label = item.trim()
      if (!label) continue
      // Legacy string[] rows cannot be mapped to LPs; skip for multi-domain mode.
      continue
    }
    if (!item || typeof item !== "object") continue
    const record = item as Record<string, unknown>
    const label = typeof record.label === "string" ? record.label.trim() : ""
    const landingPageId =
      typeof record.landingPageId === "string"
        ? record.landingPageId.trim()
        : ""
    if (!label || !landingPageId) continue
    out.push({ label, landingPageId })
  }
  return out
}

function resolveHealth(
  lastEventAt: Date | null,
  sdkInstallStatus: string
): "ok" | "waiting" | "stale" {
  if (!lastEventAt) {
    return sdkInstallStatus === "installed" ? "waiting" : "waiting"
  }
  if (Date.now() - lastEventAt.getTime() > STALE_MS) return "stale"
  return "ok"
}

export async function listSiblingLandingPages(
  workspaceId: string,
  excludeLandingPageId?: string
): Promise<SiblingLandingPageOption[]> {
  const rows = await db
    .select({
      id: landingPages.id,
      publicId: landingPages.publicId,
      brandName: landingPages.brandName,
      hostname: landingPages.hostname,
      landingPageUrl: landingPages.landingPageUrl,
    })
    .from(landingPages)
    .where(
      and(
        eq(landingPages.workspaceId, workspaceId),
        isNull(landingPages.deletedAt),
        excludeLandingPageId
          ? ne(landingPages.id, excludeLandingPageId)
          : undefined
      )
    )
    .orderBy(asc(landingPages.brandName))

  return rows
}

async function hydrateVariantHealth(
  links: ExperimentVariantLink[],
  controlLandingPageId: string | null
): Promise<ExperimentVariantHealth[]> {
  if (links.length === 0) return []

  const ids = [...new Set(links.map((link) => link.landingPageId))]
  const rows = await db
    .select()
    .from(landingPages)
    .where(and(inArray(landingPages.id, ids), isNull(landingPages.deletedAt)))

  const byId = new Map(rows.map((row) => [row.id, row]))
  const result: ExperimentVariantHealth[] = []

  for (const link of links) {
    const lp = byId.get(link.landingPageId)
    if (!lp) continue
    result.push({
      label: link.label,
      landingPageId: lp.id,
      publicId: lp.publicId,
      brandName: lp.brandName,
      hostname: lp.hostname,
      landingPageUrl: lp.landingPageUrl,
      sdkInstallStatus: lp.sdkInstallStatus,
      lastEventAt: lp.lastEventAt ? lp.lastEventAt.toISOString() : null,
      isControl: controlLandingPageId === lp.id,
      health: resolveHealth(lp.lastEventAt, lp.sdkInstallStatus),
    })
  }

  return result
}

export async function getExperimentConfigForLandingPage(
  hub: LandingPageRow
): Promise<{
  experiment: ExperimentConfigView | null
  siblings: SiblingLandingPageOption[]
}> {
  const [expRows, siblings] = await Promise.all([
    db
      .select()
      .from(experiments)
      .where(eq(experiments.landingPageId, hub.id))
      .orderBy(asc(experiments.createdAt))
      .limit(1),
    listSiblingLandingPages(hub.workspaceId),
  ])

  const exp = expRows[0]
  if (!exp) {
    return { experiment: null, siblings }
  }

  const links = normalizeExperimentVariants(exp.variants)
  const variants = await hydrateVariantHealth(links, exp.controlLandingPageId)

  return {
    experiment: {
      id: exp.id,
      name: exp.name,
      status: exp.status,
      startDate: toDateKey(exp.startDate),
      endDate: exp.endDate ? toDateKey(exp.endDate) : null,
      noEndDate: exp.endDate == null,
      controlLandingPageId: exp.controlLandingPageId,
      variants,
      variantLabels: variants.map((v) => v.label).join(" / "),
    },
    siblings,
  }
}

function validateStatus(value: unknown): ExperimentStatus | null {
  if (typeof value !== "string") return null
  const allowed: ExperimentStatus[] = [
    "Draft",
    "Running",
    "Paused",
    "Completed",
  ]
  return allowed.includes(value as ExperimentStatus)
    ? (value as ExperimentStatus)
    : null
}

async function assertLinksInWorkspace(
  workspaceId: string,
  links: ExperimentVariantLink[]
): Promise<string | null> {
  if (links.length === 0) return null
  const labels = new Set<string>()
  for (const link of links) {
    const key = link.label.toLowerCase()
    if (labels.has(key)) {
      return `Duplicate variant label: ${link.label}`
    }
    labels.add(key)
  }

  const ids = [...new Set(links.map((l) => l.landingPageId))]
  const rows = await db
    .select({ id: landingPages.id, workspaceId: landingPages.workspaceId })
    .from(landingPages)
    .where(
      and(
        inArray(landingPages.id, ids),
        eq(landingPages.workspaceId, workspaceId),
        isNull(landingPages.deletedAt)
      )
    )

  const allowed = new Set(rows.map((row) => row.id))

  for (const id of ids) {
    if (!allowed.has(id)) {
      return "Each variant must be a landing page in this workspace"
    }
  }
  return null
}

export async function createExperimentForLandingPage(
  hub: LandingPageRow,
  input: {
    name: string
    status?: string
    startDate?: string
    endDate?: string | null
    noEndDate?: boolean
    variants?: ExperimentVariantLink[]
    controlLandingPageId?: string | null
  }
): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  const name = input.name.trim()
  if (!name) return { ok: false, error: "Name is required" }

  const existing = await db
    .select({ id: experiments.id })
    .from(experiments)
    .where(eq(experiments.landingPageId, hub.id))
    .limit(1)
  if (existing[0]) {
    return { ok: false, error: "An experiment already exists for this project" }
  }

  const status = validateStatus(input.status) ?? "Running"
  const startDate = input.startDate ? parseDateKey(input.startDate) : new Date()
  if (!startDate) return { ok: false, error: "Invalid start date" }

  const noEndDate = input.noEndDate !== false && !input.endDate
  const endDate =
    noEndDate || input.endDate == null ? null : parseDateKey(input.endDate)
  if (input.endDate && !noEndDate && !endDate) {
    return { ok: false, error: "Invalid end date" }
  }

  let variants = input.variants ?? [
    {
      label: "Control",
      landingPageId: hub.id,
    },
  ]
  variants = normalizeExperimentVariants(variants)
  if (variants.length === 0) {
    variants = [{ label: "Control", landingPageId: hub.id }]
  }

  const linkError = await assertLinksInWorkspace(hub.workspaceId, variants)
  if (linkError) return { ok: false, error: linkError }

  const controlLandingPageId =
    input.controlLandingPageId === undefined
      ? (variants[0]?.landingPageId ?? null)
      : input.controlLandingPageId
  if (
    controlLandingPageId &&
    !variants.some((v) => v.landingPageId === controlLandingPageId)
  ) {
    return { ok: false, error: "Control must be one of the linked variants" }
  }

  const id = crypto.randomUUID()
  const now = new Date()
  await db.insert(experiments).values({
    id,
    landingPageId: hub.id,
    name,
    status,
    variants,
    controlLandingPageId,
    startDate,
    endDate,
    highlighted: null,
    createdAt: now,
    updatedAt: now,
  })

  return { ok: true, id }
}

export async function updateExperimentForLandingPage(
  hub: LandingPageRow,
  experimentId: string,
  input: {
    name?: string
    status?: string
    startDate?: string
    endDate?: string | null
    noEndDate?: boolean
    variants?: ExperimentVariantLink[]
    controlLandingPageId?: string | null
  }
): Promise<{ ok: true } | { ok: false; error: string; status?: number }> {
  const rows = await db
    .select()
    .from(experiments)
    .where(
      and(
        eq(experiments.id, experimentId),
        eq(experiments.landingPageId, hub.id)
      )
    )
    .limit(1)
  const exp = rows[0]
  if (!exp) return { ok: false, error: "Not found", status: 404 }

  const patch: Partial<typeof experiments.$inferInsert> = {
    updatedAt: new Date(),
  }

  if (input.name !== undefined) {
    const name = input.name.trim()
    if (!name) return { ok: false, error: "Name is required" }
    patch.name = name
  }

  if (input.status !== undefined) {
    const status = validateStatus(input.status)
    if (!status) return { ok: false, error: "Invalid status" }
    patch.status = status
  }

  if (input.startDate !== undefined) {
    const startDate = parseDateKey(input.startDate)
    if (!startDate) return { ok: false, error: "Invalid start date" }
    patch.startDate = startDate
  }

  if (input.noEndDate === true) {
    patch.endDate = null
  } else if (input.endDate !== undefined) {
    if (input.endDate === null) {
      patch.endDate = null
    } else {
      const endDate = parseDateKey(input.endDate)
      if (!endDate) return { ok: false, error: "Invalid end date" }
      patch.endDate = endDate
    }
  }

  let nextVariants = normalizeExperimentVariants(exp.variants)
  if (input.variants !== undefined) {
    nextVariants = normalizeExperimentVariants(input.variants)
    if (nextVariants.length === 0) {
      return { ok: false, error: "Add at least one variant" }
    }
    const linkError = await assertLinksInWorkspace(
      hub.workspaceId,
      nextVariants
    )
    if (linkError) return { ok: false, error: linkError }
    patch.variants = nextVariants
  }

  if (input.controlLandingPageId !== undefined) {
    const control = input.controlLandingPageId
    if (control && !nextVariants.some((v) => v.landingPageId === control)) {
      return { ok: false, error: "Control must be one of the linked variants" }
    }
    patch.controlLandingPageId = control
  } else if (
    exp.controlLandingPageId &&
    !nextVariants.some((v) => v.landingPageId === exp.controlLandingPageId)
  ) {
    patch.controlLandingPageId = nextVariants[0]?.landingPageId ?? null
  }

  await db
    .update(experiments)
    .set(patch)
    .where(eq(experiments.id, experimentId))

  return { ok: true }
}

export async function deleteExperimentForLandingPage(
  hub: LandingPageRow,
  experimentId: string
): Promise<{ ok: true } | { ok: false; error: string; status?: number }> {
  const rows = await db
    .select({ id: experiments.id })
    .from(experiments)
    .where(
      and(
        eq(experiments.id, experimentId),
        eq(experiments.landingPageId, hub.id)
      )
    )
    .limit(1)
  if (!rows[0]) return { ok: false, error: "Not found", status: 404 }

  await db.delete(experiments).where(eq(experiments.id, experimentId))
  return { ok: true }
}
