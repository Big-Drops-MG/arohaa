import { randomUUID } from "node:crypto"
import type { InferSelectModel } from "drizzle-orm"
import { desc, eq, and, isNull } from "drizzle-orm"
import { NextResponse } from "next/server"
import {
  db,
  generateHtmlVerificationToken,
  generatePublicLandingId,
  isVariantLabelTaken,
  landingPageSlugCandidate,
  landingPages,
  normalizeExperimentVariantLabel,
  normalizeLandingPageUrl,
  normalizedBrandName,
} from "@workspace/database"
import { canAccessProject, getActorAccess } from "@/lib/server/external-access"
import { writeLandingPageAuditLog } from "@/lib/server/landing-audit-log"
import {
  attachLandingPageAsVariant,
  getVariantLabelPlanForLandingPage,
} from "@/lib/server/experiments-store"
import {
  getActiveLandingPageForActor,
  type LandingPageRow,
} from "@/lib/server/landing-pages-store"
import {
  buildHtmlVerificationMetaTag,
  buildLandingSdkScriptTag,
  resolveLandingSdkEnv,
} from "@/lib/server/landing-snippet"
import { enforceLandingQuota } from "@/lib/server/landing-quota"
import { parseOptionalFaviconUrl } from "@/lib/server/landing-page-validation"
import { route } from "@/lib/server/route"
import { landingPageCreateBodySchema } from "@/lib/server/route-schemas"
import { getOrCreateOwnerWorkspace } from "@/lib/server/resolve-workspace"

type LandingRow = InferSelectModel<typeof landingPages>

function isUniqueViolation(err: unknown): boolean {
  const e = err as {
    code?: string
    cause?: { code?: string }
    message?: string
  }
  const code = e?.code ?? e?.cause?.code
  return (
    code === "23505" ||
    (typeof e?.message === "string" && e.message.includes("duplicate key"))
  )
}

function traceIdFrom(request: Request): string | null {
  return request.headers.get("x-trace-id")?.trim() || null
}

async function allocateLandingPageSlug(
  name: string,
  publicId: string
): Promise<string> {
  for (let sequence = 1; sequence <= 1_000; sequence += 1) {
    const candidate = landingPageSlugCandidate(name, sequence, publicId)
    const [existing] = await db
      .select({ id: landingPages.id })
      .from(landingPages)
      .where(eq(landingPages.slug, candidate))
      .limit(1)
    if (!existing) return candidate
  }
  throw new Error("Could not allocate a unique landing page slug")
}

function toJson(row: LandingRow) {
  return {
    id: row.id,
    workspaceId: row.workspaceId,
    publicId: row.publicId,
    slug: row.slug,
    brandName: row.brandName,
    landingPageUrl: row.landingPageUrl,
    normalizedUrl: row.normalizedUrl,
    origin: row.origin,
    hostname: row.hostname,
    status: row.status,
    sdkInstallStatus: row.sdkInstallStatus,
    verificationMethod: row.verificationMethod,
    verifiedAt: row.verifiedAt?.toISOString() ?? null,
    lastSeenAt: row.lastSeenAt?.toISOString() ?? null,
    lastEventAt: row.lastEventAt?.toISOString() ?? null,
    formType: row.formType,
    faviconUrl: row.faviconUrl,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  }
}

export const GET = route(
  {
    permission: "landing_pages.read",
    actor: "read",
    tab: "collection",
    rateLimit: "landing",
  },
  async ({ actor }) => {
    const access = await getActorAccess(actor)

    const rows = await db
      .select()
      .from(landingPages)
      .where(isNull(landingPages.deletedAt))
      .orderBy(desc(landingPages.createdAt))

    return NextResponse.json({
      landingPages: rows
        .filter((row) => canAccessProject(access, row.publicId))
        .map(toJson),
    })
  }
)

export const POST = route(
  {
    permission: "landing_pages.write",
    actor: "write",
    tab: "collection",
    rateLimit: "landing",
    schema: landingPageCreateBodySchema,
  },
  async ({ actor, body, request }) => {
    const ws = await getOrCreateOwnerWorkspace(actor.id)
    const quota = await enforceLandingQuota(ws.id)
    if (quota) return quota

    const { ingestApiBase, sdkScriptUrl } = resolveLandingSdkEnv()
    if (!ingestApiBase) {
      return NextResponse.json(
        {
          error:
            "Server misconfiguration: set INGEST_BASE_URL or NEXT_PUBLIC_AROHAA_INGEST_API_BASE",
        },
        { status: 500 }
      )
    }

    const formType = body.formType ?? "single"

    const faviconParsed = parseOptionalFaviconUrl(body.faviconUrl ?? "")
    if (!faviconParsed.ok) {
      return NextResponse.json({ error: faviconParsed.error }, { status: 400 })
    }

    const bn = normalizedBrandName(body.brandName)
    if (!bn.ok) {
      return NextResponse.json({ error: bn.error }, { status: 400 })
    }

    const nu = normalizeLandingPageUrl(body.landingPageUrl)
    if (!nu.ok) {
      return NextResponse.json({ error: nu.error }, { status: 400 })
    }

    const variantOfRaw = body.variantOf?.trim() ?? ""

    let variantParent: LandingPageRow | null = null
    let variantLabel = ""

    if (variantOfRaw) {
      variantParent = await getActiveLandingPageForActor(actor.id, variantOfRaw)
      if (!variantParent) {
        return NextResponse.json(
          { error: "Parent project not found" },
          { status: 404 }
        )
      }

      if (formType !== variantParent.formType) {
        return NextResponse.json(
          { error: "formType must match the parent project" },
          { status: 400 }
        )
      }

      const plan = await getVariantLabelPlanForLandingPage(variantParent)
      const labelParsed = normalizeExperimentVariantLabel(
        body.variantLabel?.trim() || plan.suggestedLabel
      )
      if (!labelParsed.ok) {
        return NextResponse.json({ error: labelParsed.error }, { status: 400 })
      }
      if (isVariantLabelTaken(labelParsed.label, plan.takenLabels)) {
        return NextResponse.json(
          {
            error: `Variant ${labelParsed.label} is already used in this experiment`,
          },
          { status: 409 }
        )
      }
      variantLabel = labelParsed.label
    }

    const traceId = traceIdFrom(request)
    const id = randomUUID()
    const createdAt = new Date()
    const updatedAt = new Date()
    const htmlToken = generateHtmlVerificationToken()

    for (let attempt = 0; attempt < 8; attempt += 1) {
      const publicId = generatePublicLandingId()
      const slug = await allocateLandingPageSlug(bn.brandName, publicId)
      const rowPayload = {
        id,
        publicId,
        slug,
        workspaceId: ws.id,
        createdByUserId: actor.id,
        updatedByUserId: null as string | null,
        brandName: bn.brandName,
        landingPageUrl: nu.landingPageUrl,
        normalizedUrl: nu.normalizedUrl,
        origin: nu.origin,
        hostname: nu.hostname,
        status: "pending_verification",
        sdkInstallStatus: "waiting",
        verifiedAt: null as Date | null,
        verificationMethod: null as string | null,
        htmlVerificationToken: htmlToken,
        metadata: null as Record<string, unknown> | null,
        notes: null as string | null,
        lastSeenAt: null as Date | null,
        lastEventAt: null as Date | null,
        deletedAt: null as Date | null,
        formType,
        faviconUrl: faviconParsed.value,
        createdAt,
        updatedAt,
      }

      try {
        await db.insert(landingPages).values(rowPayload)

        const [inserted] = await db
          .select()
          .from(landingPages)
          .where(eq(landingPages.id, id))
          .limit(1)

        if (!inserted) {
          return NextResponse.json(
            { error: "Landing page was not persisted" },
            { status: 500 }
          )
        }

        let variant: {
          label: string
          experimentId: string
          parentPublicId: string
          hubPublicId: string
          variantLabels: string[]
        } | null = null

        if (variantParent) {
          const attached = await attachLandingPageAsVariant({
            parent: variantParent,
            child: inserted,
            label: variantLabel,
          })

          if (!attached.ok) {
            await db
              .update(landingPages)
              .set({ deletedAt: new Date(), status: "archived" })
              .where(eq(landingPages.id, id))
            return NextResponse.json({ error: attached.error }, { status: 409 })
          }

          variant = {
            label: attached.label,
            experimentId: attached.experimentId,
            parentPublicId: variantParent.publicId,
            hubPublicId: attached.hubPublicId,
            variantLabels: attached.variantLabels,
          }
        }

        await writeLandingPageAuditLog({
          actorUserId: actor.id,
          landingPageId: id,
          action: "create",
          beforePayload: null,
          afterPayload: {
            workspaceId: ws.id,
            publicId,
            slug,
            brandName: bn.brandName,
            normalizedUrl: nu.normalizedUrl,
            hostname: nu.hostname,
            ...(variant
              ? {
                  variantLabel: variant.label,
                  variantOfPublicId: variant.parentPublicId,
                  experimentId: variant.experimentId,
                }
              : {}),
          },
          traceId,
        })

        const sdkSnippetHtml = buildLandingSdkScriptTag({
          sdkScriptUrl,
          ingestApiBase,
          workspaceUuid: id,
          publicLandingId: publicId,
          pageHostname: nu.hostname,
          formType,
        })

        const htmlVerificationMetaTag = buildHtmlVerificationMetaTag(htmlToken)

        return NextResponse.json(
          {
            landingPage: toJson(inserted),
            sdkSnippetHtml,
            htmlVerificationMetaTag,
            ingestApiBase,
            sdkScriptUrl,
            variant,
          },
          { status: 201 }
        )
      } catch (err) {
        if (!isUniqueViolation(err)) {
          throw err
        }
        const dup = await db
          .select({ id: landingPages.id })
          .from(landingPages)
          .where(
            and(
              eq(landingPages.normalizedUrl, nu.normalizedUrl),
              isNull(landingPages.deletedAt)
            )
          )
          .limit(1)
        if (dup.length > 0) {
          return NextResponse.json(
            {
              error: "This landing page URL is already registered",
            },
            { status: 409 }
          )
        }
      }
    }

    return NextResponse.json(
      { error: "Could not allocate a unique landing page ID" },
      { status: 503 }
    )
  }
)
