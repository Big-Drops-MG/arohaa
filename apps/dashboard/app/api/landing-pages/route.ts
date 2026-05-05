import { randomUUID } from "node:crypto"
import type { InferSelectModel } from "drizzle-orm"
import { desc, eq, and, isNull } from "drizzle-orm"
import type { NextRequest } from "next/server"
import { NextResponse } from "next/server"
import {
  db,
  generateHtmlVerificationToken,
  generatePublicLandingId,
  landingPageAuditLogs,
  landingPages,
  normalizeLandingPageUrl,
  normalizedBrandName,
} from "@workspace/database"
import { requireLandingPageActor } from "@/lib/server/landing-auth"
import {
  buildHtmlVerificationMetaTag,
  buildLandingSdkScriptTag,
  resolveLandingSdkEnv,
} from "@/lib/server/landing-snippet"
import { enforceLandingQuota } from "@/lib/server/landing-quota"
import { enforceLandingApiRateLimit } from "@/lib/server/rate-limit-landing"
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

export async function GET() {
  const actor = await requireLandingPageActor()
  if (!actor) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }
  const limited = await enforceLandingApiRateLimit(actor.id)
  if (limited) return limited

  const ws = await getOrCreateOwnerWorkspace(actor.id)

  const rows = await db
    .select()
    .from(landingPages)
    .where(
      and(eq(landingPages.workspaceId, ws.id), isNull(landingPages.deletedAt))
    )
    .orderBy(desc(landingPages.createdAt))

  return NextResponse.json({ landingPages: rows.map(toJson) })
}

export async function POST(request: NextRequest) {
  const actor = await requireLandingPageActor()
  if (!actor) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }
  const limited = await enforceLandingApiRateLimit(actor.id)
  if (limited) return limited

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

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 })
  }

  const brandRaw =
    typeof body === "object" && body !== null && "brandName" in body
      ? String((body as Record<string, unknown>).brandName)
      : ""

  const urlRaw =
    typeof body === "object" && body !== null && "landingPageUrl" in body
      ? String((body as Record<string, unknown>).landingPageUrl)
      : ""

  const bn = normalizedBrandName(brandRaw)
  if (!bn.ok) {
    return NextResponse.json({ error: bn.error }, { status: 400 })
  }

  const nu = normalizeLandingPageUrl(urlRaw)
  if (!nu.ok) {
    return NextResponse.json({ error: nu.error }, { status: 400 })
  }

  const traceId = traceIdFrom(request)
  const id = randomUUID()
  const createdAt = new Date()
  const updatedAt = new Date()
  const htmlToken = generateHtmlVerificationToken()

  for (let attempt = 0; attempt < 8; attempt += 1) {
    const publicId = generatePublicLandingId()
    const rowPayload = {
      id,
      publicId,
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

      await db.insert(landingPageAuditLogs).values({
        actorUserId: actor.id,
        landingPageId: id,
        action: "create",
        beforePayload: null,
        afterPayload: {
          workspaceId: ws.id,
          publicId,
          normalizedUrl: nu.normalizedUrl,
          hostname: nu.hostname,
        },
        traceId,
      })

      const sdkSnippetHtml = buildLandingSdkScriptTag({
        sdkScriptUrl,
        ingestApiBase,
        workspaceUuid: id,
        publicLandingId: publicId,
        pageHostname: nu.hostname,
      })

      const htmlVerificationMetaTag = buildHtmlVerificationMetaTag(htmlToken)

      return NextResponse.json(
        {
          landingPage: toJson(inserted),
          sdkSnippetHtml,
          htmlVerificationMetaTag,
          ingestApiBase,
          sdkScriptUrl,
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
            eq(landingPages.workspaceId, ws.id),
            eq(landingPages.normalizedUrl, nu.normalizedUrl),
            isNull(landingPages.deletedAt)
          )
        )
        .limit(1)
      if (dup.length > 0) {
        return NextResponse.json(
          {
            error:
              "This landing page URL is already registered for this workspace",
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
