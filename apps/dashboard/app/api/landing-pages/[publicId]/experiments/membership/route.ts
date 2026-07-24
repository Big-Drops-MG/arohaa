import { NextResponse } from "next/server"
import { requireLandingPageActor } from "@/lib/server/landing-auth"
import {
  getActiveLandingPageForActor,
  getActiveLandingPageInWorkspace,
  type LandingPageRow,
} from "@/lib/server/landing-pages-store"
import {
  attachLandingPageAsVariant,
  getExperimentMembershipForLandingPage,
  leaveExperimentForLandingPage,
  renameVariantLabelForLandingPage,
} from "@/lib/server/experiments-store"
import { enforceLandingApiRateLimit } from "@/lib/server/rate-limit-landing"
import { writeLandingPageAuditLog } from "@/lib/server/landing-audit-log"

async function resolveActorAndPage(
  publicId: string
): Promise<
  | { ok: true; actorId: string; landingPage: LandingPageRow }
  | { ok: false; response: NextResponse }
> {
  const actor = await requireLandingPageActor()
  if (!actor) {
    return {
      ok: false,
      response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    }
  }
  const limited = await enforceLandingApiRateLimit(actor.id)
  if (limited) return { ok: false, response: limited }

  const landingPage = await getActiveLandingPageForActor(actor.id, publicId)
  if (!landingPage) {
    return {
      ok: false,
      response: NextResponse.json({ error: "Not found" }, { status: 404 }),
    }
  }

  return { ok: true, actorId: actor.id, landingPage }
}

export async function GET(
  _request: Request,
  props: { params: Promise<{ publicId: string }> }
) {
  const { publicId } = await props.params
  const resolved = await resolveActorAndPage(publicId)
  if (!resolved.ok) return resolved.response

  const data = await getExperimentMembershipForLandingPage(resolved.landingPage)
  return NextResponse.json(data)
}

export async function POST(
  request: Request,
  props: { params: Promise<{ publicId: string }> }
) {
  const { publicId } = await props.params
  const resolved = await resolveActorAndPage(publicId)
  if (!resolved.ok) return resolved.response
  const { actorId, landingPage } = resolved

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 })
  }
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 })
  }

  const record = body as Record<string, unknown>
  const parentPublicId =
    typeof record.parentPublicId === "string"
      ? record.parentPublicId.trim()
      : ""
  const label = typeof record.label === "string" ? record.label : ""

  if (!parentPublicId) {
    return NextResponse.json(
      { error: "Choose the project to compare against" },
      { status: 400 }
    )
  }
  if (parentPublicId === landingPage.publicId) {
    return NextResponse.json(
      { error: "A project cannot be a variant of itself" },
      { status: 400 }
    )
  }

  const parent = await getActiveLandingPageInWorkspace(
    landingPage.workspaceId,
    parentPublicId
  )
  if (!parent) {
    return NextResponse.json(
      { error: "Parent project not found" },
      { status: 404 }
    )
  }

  const attached = await attachLandingPageAsVariant({
    parent,
    child: landingPage,
    label,
  })
  if (!attached.ok) {
    return NextResponse.json({ error: attached.error }, { status: 409 })
  }

  await writeLandingPageAuditLog({
    actorUserId: actorId,
    landingPageId: landingPage.id,
    action: "variant_link",
    beforePayload: null,
    afterPayload: {
      variantLabel: attached.label,
      variantOfBrandName: parent.brandName,
      experimentId: attached.experimentId,
    },
    traceId: request.headers.get("x-trace-id")?.trim() || null,
  })

  const data = await getExperimentMembershipForLandingPage(landingPage)
  return NextResponse.json(data, { status: 201 })
}

export async function PATCH(
  request: Request,
  props: { params: Promise<{ publicId: string }> }
) {
  const { publicId } = await props.params
  const resolved = await resolveActorAndPage(publicId)
  if (!resolved.ok) return resolved.response

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 })
  }
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 })
  }

  const label = (body as Record<string, unknown>).label
  if (typeof label !== "string") {
    return NextResponse.json({ error: "label is required" }, { status: 400 })
  }

  const renamed = await renameVariantLabelForLandingPage(
    resolved.landingPage,
    label
  )
  if (!renamed.ok) {
    return NextResponse.json(
      { error: renamed.error },
      { status: renamed.status ?? 400 }
    )
  }

  const data = await getExperimentMembershipForLandingPage(resolved.landingPage)
  return NextResponse.json(data)
}

export async function DELETE(
  request: Request,
  props: { params: Promise<{ publicId: string }> }
) {
  const { publicId } = await props.params
  const resolved = await resolveActorAndPage(publicId)
  if (!resolved.ok) return resolved.response
  const { actorId, landingPage } = resolved

  const left = await leaveExperimentForLandingPage(landingPage)
  if (!left.ok) {
    return NextResponse.json(
      { error: left.error },
      { status: left.status ?? 400 }
    )
  }

  await writeLandingPageAuditLog({
    actorUserId: actorId,
    landingPageId: landingPage.id,
    action: "variant_unlink",
    beforePayload: null,
    afterPayload: {
      experimentName: left.experimentName,
      experimentDeleted: left.experimentDeleted,
    },
    traceId: request.headers.get("x-trace-id")?.trim() || null,
  })

  const data = await getExperimentMembershipForLandingPage(landingPage)
  return NextResponse.json({ ...data, ...left })
}
