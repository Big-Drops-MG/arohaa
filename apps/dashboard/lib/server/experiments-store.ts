import { and, asc, eq, inArray, isNull, ne, or } from "drizzle-orm"
import {
  db,
  experimentIncludesLandingPage,
  experimentVariantLabels,
  experiments,
  isVariantLabelTaken,
  landingPages,
  nextAvailableVariantLabel,
  normalizeExperimentVariantLabel,
  normalizeExperimentVariantLinks,
  VARIANT_LABEL_SEQUENCE,
  type ExperimentStatus,
  type ExperimentVariantLink,
} from "@workspace/database"
import type { LandingPageRow } from "@/lib/server/landing-pages-store"
import {
  isUniqueViolation,
  uniqueViolationMessage,
} from "@/lib/server/db-errors"

export type ExperimentVariantHealth = {
  label: string
  landingPageId: string
  publicId: string
  slug: string
  brandName: string
  hostname: string
  landingPageUrl: string
  sdkInstallStatus: string
  lastEventAt: string | null
  isControl: boolean
  isCurrent: boolean
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
  hubLandingPageId: string
  hubPublicId: string | null
  hubSlug: string | null
  hubBrandName: string | null
  isHub: boolean
  currentLabel: string | null
}

export type SiblingLandingPageOption = {
  id: string
  publicId: string
  slug: string
  brandName: string
  hostname: string
  landingPageUrl: string
  formType: string
}

type ExperimentRow = typeof experiments.$inferSelect

export type ExperimentsDb = Pick<
  typeof db,
  "select" | "update" | "delete" | "insert"
>

type ExperimentWriteClient = Pick<typeof db, "delete" | "insert">

async function replaceExperimentVariantLabels(
  client: ExperimentWriteClient,
  experimentId: string,
  labels: string[]
) {
  await client
    .delete(experimentVariantLabels)
    .where(eq(experimentVariantLabels.experimentId, experimentId))

  if (labels.length === 0) return

  await client.insert(experimentVariantLabels).values(
    labels.map((label) => ({
      experimentId,
      label,
    }))
  )
}

function experimentConflict(err: unknown, fallback: string) {
  return {
    ok: false as const,
    error: uniqueViolationMessage(err, fallback),
    status: 409 as const,
  }
}

export type ExperimentResolution = {
  experiment: ExperimentRow
  isHub: boolean
}

const STALE_MS = 7 * 24 * 60 * 60 * 1000

async function activeVariantLinks(
  links: ExperimentVariantLink[],
  client: ExperimentsDb = db
): Promise<ExperimentVariantLink[]> {
  if (links.length === 0) return []
  const ids = links.map((link) => link.landingPageId)
  const rows = await client
    .select({ id: landingPages.id })
    .from(landingPages)
    .where(and(inArray(landingPages.id, ids), isNull(landingPages.deletedAt)))
  const activeIds = new Set(rows.map((row) => row.id))
  return links.filter((link) => activeIds.has(link.landingPageId))
}

function toDateKey(date: Date): string {
  return date.toISOString().slice(0, 10)
}

function parseDateKey(value: string): Date | null {
  const trimmed = value.trim()
  if (!/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return null
  const date = new Date(`${trimmed}T00:00:00.000Z`)
  return Number.isNaN(date.getTime()) ? null : date
}

function resolveHealth(lastEventAt: Date | null): "ok" | "waiting" | "stale" {
  if (!lastEventAt) return "waiting"
  if (Date.now() - lastEventAt.getTime() > STALE_MS) return "stale"
  return "ok"
}

export async function resolveExperimentForLandingPage(
  landingPageId: string,
  client: ExperimentsDb = db
): Promise<ExperimentResolution | null> {
  const owned = await client
    .select()
    .from(experiments)
    .where(eq(experiments.landingPageId, landingPageId))
    .orderBy(asc(experiments.createdAt))
    .limit(1)

  if (owned[0]) return { experiment: owned[0], isHub: true }

  const linked = await client
    .select()
    .from(experiments)
    .where(experimentIncludesLandingPage(landingPageId))
    .orderBy(asc(experiments.createdAt))
    .limit(1)

  if (linked[0]) return { experiment: linked[0], isHub: false }

  return null
}

export async function listSiblingLandingPages(
  excludeLandingPageId?: string,
  opts?: { allowedPublicIds?: ReadonlySet<string> | null }
): Promise<SiblingLandingPageOption[]> {
  const rows = await db
    .select({
      id: landingPages.id,
      publicId: landingPages.publicId,
      slug: landingPages.slug,
      brandName: landingPages.brandName,
      hostname: landingPages.hostname,
      landingPageUrl: landingPages.landingPageUrl,
      formType: landingPages.formType,
    })
    .from(landingPages)
    .where(
      and(
        isNull(landingPages.deletedAt),
        excludeLandingPageId
          ? ne(landingPages.id, excludeLandingPageId)
          : undefined
      )
    )
    .orderBy(asc(landingPages.brandName))

  if (!opts?.allowedPublicIds) return rows
  return rows.filter((row) => opts.allowedPublicIds!.has(row.publicId))
}

async function hydrateVariantHealth(
  links: ExperimentVariantLink[],
  controlLandingPageId: string | null,
  currentLandingPageId: string
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
      slug: lp.slug,
      brandName: lp.brandName,
      hostname: lp.hostname,
      landingPageUrl: lp.landingPageUrl,
      sdkInstallStatus: lp.sdkInstallStatus,
      lastEventAt: lp.lastEventAt ? lp.lastEventAt.toISOString() : null,
      isControl: controlLandingPageId === lp.id,
      isCurrent: currentLandingPageId === lp.id,
      health: resolveHealth(lp.lastEventAt),
    })
  }

  return result
}

export async function getExperimentConfigForLandingPage(
  landingPage: LandingPageRow,
  opts?: { allowedPublicIds?: ReadonlySet<string> | null }
): Promise<{
  experiment: ExperimentConfigView | null
  siblings: SiblingLandingPageOption[]
}> {
  const [resolution, siblings] = await Promise.all([
    resolveExperimentForLandingPage(landingPage.id),
    listSiblingLandingPages(landingPage.id, opts),
  ])

  if (!resolution) {
    return { experiment: null, siblings }
  }

  const { experiment: exp, isHub } = resolution
  const links = normalizeExperimentVariantLinks(exp.variants)
  const variants = await hydrateVariantHealth(
    links,
    exp.controlLandingPageId,
    landingPage.id
  )

  const hub = isHub
    ? {
        publicId: landingPage.publicId,
        slug: landingPage.slug,
        brandName: landingPage.brandName,
      }
    : ((
        await db
          .select({
            publicId: landingPages.publicId,
            slug: landingPages.slug,
            brandName: landingPages.brandName,
          })
          .from(landingPages)
          .where(eq(landingPages.id, exp.landingPageId))
          .limit(1)
      )[0] ?? null)

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
      hubLandingPageId: exp.landingPageId,
      hubPublicId: hub?.publicId ?? null,
      hubSlug: hub?.slug ?? null,
      hubBrandName: hub?.brandName ?? null,
      isHub,
      currentLabel: variants.find((v) => v.isCurrent)?.label ?? null,
    },
    siblings,
  }
}

export type VariantLabelPlan = {
  hasExperiment: boolean
  experimentName: string | null
  parentLabel: string
  takenLabels: string[]
  availableLabels: string[]
  suggestedLabel: string
}

export async function getVariantLabelPlanForLandingPage(
  parent: LandingPageRow
): Promise<VariantLabelPlan> {
  const resolution = await resolveExperimentForLandingPage(parent.id)

  if (!resolution) {
    const parentLabel = VARIANT_LABEL_SEQUENCE[0]
    const takenLabels = [parentLabel]
    const availableLabels = VARIANT_LABEL_SEQUENCE.filter(
      (label) => !isVariantLabelTaken(label, takenLabels)
    )
    return {
      hasExperiment: false,
      experimentName: null,
      parentLabel,
      takenLabels,
      availableLabels,
      suggestedLabel: nextAvailableVariantLabel(takenLabels),
    }
  }

  const links = normalizeExperimentVariantLinks(resolution.experiment.variants)
  const takenLabels = links.map((link) => link.label)
  const parentLabel =
    links.find((link) => link.landingPageId === parent.id)?.label ??
    nextAvailableVariantLabel(takenLabels)

  const reserved = takenLabels.includes(parentLabel)
    ? takenLabels
    : [...takenLabels, parentLabel]

  return {
    hasExperiment: true,
    experimentName: resolution.experiment.name,
    parentLabel,
    takenLabels: reserved,
    availableLabels: VARIANT_LABEL_SEQUENCE.filter(
      (label) => !isVariantLabelTaken(label, reserved)
    ),
    suggestedLabel: nextAvailableVariantLabel(reserved),
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

async function assertVariantLinksExist(
  links: ExperimentVariantLink[],
  currentExperimentId?: string | null,
  opts?: { allowedLandingPageIds?: ReadonlySet<string> | null }
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
  if (ids.length !== links.length) {
    return "Each landing page can only be linked once"
  }

  if (opts?.allowedLandingPageIds) {
    for (const id of ids) {
      if (!opts.allowedLandingPageIds.has(id)) {
        return "Each variant must be a landing page you can access"
      }
    }
  }

  const rows = await db
    .select({ id: landingPages.id, brandName: landingPages.brandName })
    .from(landingPages)
    .where(and(inArray(landingPages.id, ids), isNull(landingPages.deletedAt)))

  const brandNames = new Map(rows.map((row) => [row.id, row.brandName]))

  for (const id of ids) {
    if (!brandNames.has(id)) {
      return "Each variant must be an active landing page"
    }
  }

  const conflicts = await db
    .select({ name: experiments.name, variants: experiments.variants })
    .from(experiments)
    .where(
      and(
        currentExperimentId
          ? ne(experiments.id, currentExperimentId)
          : undefined,
        or(
          inArray(experiments.landingPageId, ids),
          ...ids.map((id) => experimentIncludesLandingPage(id))
        )
      )
    )

  for (const conflict of conflicts) {
    const taken = normalizeExperimentVariantLinks(conflict.variants).find(
      (link) => ids.includes(link.landingPageId)
    )
    if (taken) {
      return `${brandNames.get(taken.landingPageId)} already belongs to the experiment "${conflict.name}". Remove it from that experiment first.`
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
): Promise<
  { ok: true; id: string } | { ok: false; error: string; status?: number }
> {
  const name = input.name.trim()
  if (!name) return { ok: false, error: "Name is required" }

  const status = validateStatus(input.status) ?? "Running"
  const startDate = input.startDate ? parseDateKey(input.startDate) : new Date()
  if (!startDate) return { ok: false, error: "Invalid start date" }

  const noEndDate = input.noEndDate !== false && !input.endDate
  const endDate =
    noEndDate || input.endDate == null ? null : parseDateKey(input.endDate)
  if (input.endDate && !noEndDate && !endDate) {
    return { ok: false, error: "Invalid end date" }
  }

  let variants = normalizeExperimentVariantLinks(input.variants ?? [])
  if (variants.length === 0) {
    variants = [{ label: "A", landingPageId: hub.id }]
  }

  const linkError = await assertVariantLinksExist(variants)
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

  try {
    await db.transaction(async (tx) => {
      await tx.insert(experiments).values({
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
      await tx.insert(experimentVariantLabels).values(
        variants.map((variant) => ({
          experimentId: id,
          label: variant.label,
        }))
      )
    })
  } catch (err) {
    if (isUniqueViolation(err)) {
      return experimentConflict(
        err,
        "An experiment already exists for this project"
      )
    }
    throw err
  }

  return { ok: true, id }
}

export async function attachLandingPageAsVariant({
  parent,
  child,
  label,
  experimentName,
}: {
  parent: LandingPageRow
  child: LandingPageRow
  label: string
  experimentName?: string
}): Promise<
  | {
      ok: true
      experimentId: string
      label: string
      hubPublicId: string
      variantLabels: string[]
    }
  | { ok: false; error: string; status?: number }
> {
  if (parent.id === child.id) {
    return { ok: false, error: "A landing page cannot be its own variant" }
  }

  const parsedLabel = normalizeExperimentVariantLabel(label)
  if (!parsedLabel.ok) return { ok: false, error: parsedLabel.error }

  const childResolution = await resolveExperimentForLandingPage(child.id)
  if (childResolution) {
    return {
      ok: false,
      error: `${child.brandName} already belongs to the experiment "${childResolution.experiment.name}". Leave that experiment first.`,
    }
  }

  const resolution = await resolveExperimentForLandingPage(parent.id)
  const now = new Date()

  if (!resolution) {
    const parentLabel = nextAvailableVariantLabel([parsedLabel.label])
    const variants: ExperimentVariantLink[] = [
      { label: parentLabel, landingPageId: parent.id },
      { label: parsedLabel.label, landingPageId: child.id },
    ]
    const experimentId = crypto.randomUUID()

    try {
      await db.transaction(async (tx) => {
        await tx.insert(experiments).values({
          id: experimentId,
          landingPageId: parent.id,
          name: experimentName?.trim() || `${parent.brandName} A/B test`,
          status: "Running",
          variants,
          controlLandingPageId: parent.id,
          startDate: now,
          endDate: null,
          highlighted: null,
          createdAt: now,
          updatedAt: now,
        })
        await tx.insert(experimentVariantLabels).values(
          variants.map((variant) => ({
            experimentId,
            label: variant.label,
          }))
        )
      })
    } catch (err) {
      if (isUniqueViolation(err)) {
        return experimentConflict(
          err,
          "An experiment already exists for this project"
        )
      }
      throw err
    }

    return {
      ok: true,
      experimentId,
      label: parsedLabel.label,
      hubPublicId: parent.publicId,
      variantLabels: variants.map((v) => v.label),
    }
  }

  const { experiment } = resolution
  const variants = normalizeExperimentVariantLinks(experiment.variants)

  if (variants.some((v) => v.landingPageId === child.id)) {
    return { ok: false, error: "This landing page is already a variant" }
  }

  if (!variants.some((v) => v.landingPageId === parent.id)) {
    variants.unshift({
      label: nextAvailableVariantLabel([
        ...variants.map((v) => v.label),
        parsedLabel.label,
      ]),
      landingPageId: parent.id,
    })
  }

  variants.push({ label: parsedLabel.label, landingPageId: child.id })

  const [hub] = await db
    .select({ publicId: landingPages.publicId })
    .from(landingPages)
    .where(eq(landingPages.id, experiment.landingPageId))
    .limit(1)

  try {
    await db.transaction(async (tx) => {
      await tx.insert(experimentVariantLabels).values({
        experimentId: experiment.id,
        label: parsedLabel.label,
      })
      await tx
        .update(experiments)
        .set({
          variants,
          controlLandingPageId:
            experiment.controlLandingPageId ??
            variants[0]?.landingPageId ??
            null,
          updatedAt: now,
        })
        .where(eq(experiments.id, experiment.id))
    })
  } catch (err) {
    if (isUniqueViolation(err)) {
      return experimentConflict(
        err,
        `Variant ${parsedLabel.label} is already used in this experiment`
      )
    }
    throw err
  }

  return {
    ok: true,
    experimentId: experiment.id,
    label: parsedLabel.label,
    hubPublicId: hub?.publicId ?? parent.publicId,
    variantLabels: variants.map((v) => v.label),
  }
}

export type ExperimentMembershipVariant = {
  label: string
  publicId: string
  slug: string
  brandName: string
  hostname: string
  isControl: boolean
  isCurrent: boolean
}

export type ExperimentMembershipView = {
  experimentId: string
  experimentName: string
  status: string
  label: string | null
  isHub: boolean
  hubPublicId: string | null
  hubSlug: string | null
  hubBrandName: string | null
  variants: ExperimentMembershipVariant[]
}

export async function getExperimentMembershipForLandingPage(
  landingPage: LandingPageRow
): Promise<{
  membership: ExperimentMembershipView | null
  candidates: SiblingLandingPageOption[]
}> {
  const { experiment, siblings } =
    await getExperimentConfigForLandingPage(landingPage)

  if (!experiment) {
    return { membership: null, candidates: siblings }
  }

  return {
    membership: {
      experimentId: experiment.id,
      experimentName: experiment.name,
      status: experiment.status,
      label: experiment.currentLabel,
      isHub: experiment.isHub,
      hubPublicId: experiment.hubPublicId,
      hubSlug: experiment.hubSlug,
      hubBrandName: experiment.hubBrandName,
      variants: experiment.variants.map((variant) => ({
        label: variant.label,
        publicId: variant.publicId,
        slug: variant.slug,
        brandName: variant.brandName,
        hostname: variant.hostname,
        isControl: variant.isControl,
        isCurrent: variant.isCurrent,
      })),
    },
    candidates: siblings,
  }
}

export async function renameVariantLabelForLandingPage(
  landingPage: LandingPageRow,
  rawLabel: string
): Promise<
  { ok: true; label: string } | { ok: false; error: string; status?: number }
> {
  const parsed = normalizeExperimentVariantLabel(rawLabel)
  if (!parsed.ok) return { ok: false, error: parsed.error }

  const resolution = await resolveExperimentForLandingPage(landingPage.id)
  if (!resolution) {
    return {
      ok: false,
      error: "This project is not part of an experiment",
      status: 404,
    }
  }

  const { experiment } = resolution
  const links = normalizeExperimentVariantLinks(experiment.variants)
  const current = links.find((link) => link.landingPageId === landingPage.id)
  if (!current) {
    return {
      ok: false,
      error: "This project is not linked as a variant",
      status: 404,
    }
  }
  if (current.label === parsed.label) {
    return { ok: true, label: parsed.label }
  }

  try {
    await db.transaction(async (tx) => {
      await tx.insert(experimentVariantLabels).values({
        experimentId: experiment.id,
        label: parsed.label,
      })
      await tx
        .delete(experimentVariantLabels)
        .where(
          and(
            eq(experimentVariantLabels.experimentId, experiment.id),
            eq(experimentVariantLabels.label, current.label)
          )
        )
      await tx
        .update(experiments)
        .set({
          variants: links.map((link) =>
            link.landingPageId === landingPage.id
              ? { ...link, label: parsed.label }
              : link
          ),
          updatedAt: new Date(),
        })
        .where(eq(experiments.id, experiment.id))
    })
  } catch (err) {
    if (isUniqueViolation(err)) {
      return experimentConflict(
        err,
        `Variant ${parsed.label} is already used in this experiment`
      )
    }
    throw err
  }

  return { ok: true, label: parsed.label }
}

export async function leaveExperimentForLandingPage(
  landingPage: LandingPageRow,
  client: ExperimentsDb = db
): Promise<
  | {
      ok: true
      experimentName: string
      experimentDeleted: boolean
      transferredToPublicId: string | null
    }
  | { ok: false; error: string; status?: number }
> {
  const resolution = await resolveExperimentForLandingPage(
    landingPage.id,
    client
  )
  if (!resolution) {
    return {
      ok: false,
      error: "This project is not part of an experiment",
      status: 404,
    }
  }

  const { experiment } = resolution
  const remaining = await activeVariantLinks(
    normalizeExperimentVariantLinks(experiment.variants).filter(
      (link) => link.landingPageId !== landingPage.id
    ),
    client
  )

  if (remaining.length === 0) {
    await client.delete(experiments).where(eq(experiments.id, experiment.id))
    return {
      ok: true,
      experimentName: experiment.name,
      experimentDeleted: true,
      transferredToPublicId: null,
    }
  }

  const nextHubId =
    experiment.landingPageId === landingPage.id
      ? remaining[0]!.landingPageId
      : experiment.landingPageId

  const nextControlId =
    experiment.controlLandingPageId === landingPage.id ||
    experiment.controlLandingPageId == null ||
    !remaining.some(
      (link) => link.landingPageId === experiment.controlLandingPageId
    )
      ? (remaining[0]?.landingPageId ?? null)
      : experiment.controlLandingPageId

  await replaceExperimentVariantLabels(
    client,
    experiment.id,
    remaining.map((link) => link.label)
  )
  await client
    .update(experiments)
    .set({
      landingPageId: nextHubId,
      variants: remaining,
      controlLandingPageId: nextControlId,
      updatedAt: new Date(),
    })
    .where(eq(experiments.id, experiment.id))

  const transferred = nextHubId !== experiment.landingPageId
  const [nextHub] = transferred
    ? await client
        .select({ publicId: landingPages.publicId })
        .from(landingPages)
        .where(eq(landingPages.id, nextHubId))
        .limit(1)
    : []

  return {
    ok: true,
    experimentName: experiment.name,
    experimentDeleted: false,
    transferredToPublicId: nextHub?.publicId ?? null,
  }
}

async function getParticipatingExperiment(
  landingPage: LandingPageRow,
  experimentId: string
): Promise<
  | { ok: true; experiment: ExperimentRow }
  | { ok: false; error: string; status: number }
> {
  const rows = await db
    .select()
    .from(experiments)
    .where(eq(experiments.id, experimentId))
    .limit(1)

  const exp = rows[0]
  if (!exp) return { ok: false, error: "Not found", status: 404 }

  const participates =
    exp.landingPageId === landingPage.id ||
    normalizeExperimentVariantLinks(exp.variants).some(
      (link) => link.landingPageId === landingPage.id
    )

  if (!participates) {
    return { ok: false, error: "Not found", status: 404 }
  }

  return { ok: true, experiment: exp }
}

export async function updateExperimentForLandingPage(
  landingPage: LandingPageRow,
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
  const found = await getParticipatingExperiment(landingPage, experimentId)
  if (!found.ok) return found
  const exp = found.experiment

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

  let nextVariants = normalizeExperimentVariantLinks(exp.variants)
  if (input.variants !== undefined) {
    nextVariants = normalizeExperimentVariantLinks(input.variants)
    if (nextVariants.length === 0) {
      return { ok: false, error: "Add at least one variant" }
    }
    const linkError = await assertVariantLinksExist(nextVariants, experimentId)
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

  const variantsChanged = input.variants !== undefined

  try {
    if (variantsChanged) {
      await db.transaction(async (tx) => {
        await replaceExperimentVariantLabels(
          tx,
          experimentId,
          nextVariants.map((variant) => variant.label)
        )
        await tx
          .update(experiments)
          .set(patch)
          .where(eq(experiments.id, experimentId))
      })
    } else {
      await db
        .update(experiments)
        .set(patch)
        .where(eq(experiments.id, experimentId))
    }
  } catch (err) {
    if (isUniqueViolation(err)) {
      return experimentConflict(
        err,
        "That variant label is already used in this experiment"
      )
    }
    throw err
  }

  return { ok: true }
}

export async function deleteExperimentForLandingPage(
  landingPage: LandingPageRow,
  experimentId: string
): Promise<{ ok: true } | { ok: false; error: string; status?: number }> {
  const found = await getParticipatingExperiment(landingPage, experimentId)
  if (!found.ok) return found

  await db.delete(experiments).where(eq(experiments.id, experimentId))
  return { ok: true }
}
