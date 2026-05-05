import type { InferSelectModel } from "drizzle-orm"
import { eq } from "drizzle-orm"
import type { NextRequest } from "next/server"
import { NextResponse } from "next/server"
import {
  db,
  generateHtmlVerificationToken,
  landingPageAuditLogs,
  landingPages,
  normalizeLandingPageUrl,
  normalizedBrandName,
} from "@workspace/database"
import { requireLandingPageActor } from "@/lib/server/landing-auth"
import { getActiveLandingPageInWorkspace } from "@/lib/server/landing-pages-store"
import { buildHtmlVerificationMetaTag } from "@/lib/server/landing-snippet"
import { enforceLandingApiRateLimit } from "@/lib/server/rate-limit-landing"
import { getOrCreateOwnerWorkspace } from "@/lib/server/resolve-workspace"

type LandingRow = InferSelectModel<typeof landingPages>

function traceIdFrom(request: NextRequest): string | null {
  return request.headers.get("x-trace-id")?.trim() || null
}

function toJson(row: LandingRow) {
  return {
    id: row.id,
    workspaceId: row.workspaceId,
    publicId: row.publicId,
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
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  }
}

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

export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ publicId: string }> }
) {
  const actor = await requireLandingPageActor()
  if (!actor) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }
  const limited = await enforceLandingApiRateLimit(actor.id)
  if (limited) return limited

  const ws = await getOrCreateOwnerWorkspace(actor.id)

  const { publicId } = await context.params
  const row = await getActiveLandingPageInWorkspace(ws.id, publicId)
  if (!row) {
    return NextResponse.json({ error: "Not found" }, { status: 404 })
  }

  return NextResponse.json({ landingPage: toJson(row) })
}

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ publicId: string }> }
) {
  const actor = await requireLandingPageActor()
  if (!actor) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }
  const limited = await enforceLandingApiRateLimit(actor.id)
  if (limited) return limited

  const ws = await getOrCreateOwnerWorkspace(actor.id)

  const { publicId } = await context.params
  const row = await getActiveLandingPageInWorkspace(ws.id, publicId)
  if (!row) {
    return NextResponse.json({ error: "Not found" }, { status: 404 })
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 })
  }

  const record = body as Record<string, unknown>

  const before = {
    brandName: row.brandName,
    landingPageUrl: row.landingPageUrl,
    normalizedUrl: row.normalizedUrl,
    hostname: row.hostname,
    origin: row.origin,
    verificationMethod: row.verificationMethod,
    htmlTokenRotated: false,
  }

  let nextBrand = row.brandName
  if ("brandName" in record) {
    const bn = normalizedBrandName(String(record.brandName))
    if (!bn.ok) {
      return NextResponse.json({ error: bn.error }, { status: 400 })
    }
    nextBrand = bn.brandName
  }

  let urlFields: {
    landingPageUrl: string
    normalizedUrl: string
    origin: string
    hostname: string
  } = {
    landingPageUrl: row.landingPageUrl,
    normalizedUrl: row.normalizedUrl,
    origin: row.origin,
    hostname: row.hostname,
  }

  let urlChanged = false
  if ("landingPageUrl" in record) {
    const nu = normalizeLandingPageUrl(String(record.landingPageUrl))
    if (!nu.ok) {
      return NextResponse.json({ error: nu.error }, { status: 400 })
    }
    urlFields = {
      landingPageUrl: nu.landingPageUrl,
      normalizedUrl: nu.normalizedUrl,
      origin: nu.origin,
      hostname: nu.hostname,
    }
    urlChanged = nu.normalizedUrl !== row.normalizedUrl
  }

  const nextHtmlVerificationToken =
    urlChanged || !row.htmlVerificationToken
      ? generateHtmlVerificationToken()
      : row.htmlVerificationToken

  const now = new Date()

  try {
    await db
      .update(landingPages)
      .set({
        brandName: nextBrand,
        ...urlFields,
        htmlVerificationToken: nextHtmlVerificationToken ?? null,
        updatedByUserId: actor.id,
        updatedAt: now,
        sdkInstallStatus: "waiting",
        status: "pending_verification",
        verifiedAt: null,
        verificationMethod: null,
        lastSeenAt: null,
        lastEventAt: null,
      })
      .where(eq(landingPages.id, row.id))
  } catch (err) {
    if (isUniqueViolation(err)) {
      return NextResponse.json(
        {
          error:
            "This landing page URL is already registered for this workspace",
        },
        { status: 409 }
      )
    }
    throw err
  }

  const [saved] = await db
    .select()
    .from(landingPages)
    .where(eq(landingPages.id, row.id))
    .limit(1)

  if (!saved) {
    return NextResponse.json({ error: "Update failed" }, { status: 500 })
  }

  await db.insert(landingPageAuditLogs).values({
    actorUserId: actor.id,
    landingPageId: row.id,
    action: "update",
    beforePayload: before,
    afterPayload: {
      brandName: saved.brandName,
      landingPageUrl: saved.landingPageUrl,
      normalizedUrl: saved.normalizedUrl,
      hostname: saved.hostname,
      origin: saved.origin,
      verificationMethod: saved.verificationMethod,
      htmlTokenRotated: urlChanged,
    },
    traceId: traceIdFrom(request),
  })

  const htmlVerificationMetaTag =
    urlChanged && saved.htmlVerificationToken
      ? buildHtmlVerificationMetaTag(saved.htmlVerificationToken)
      : undefined

  return NextResponse.json({
    landingPage: toJson(saved),
    ...(htmlVerificationMetaTag ? { htmlVerificationMetaTag } : {}),
  })
}
