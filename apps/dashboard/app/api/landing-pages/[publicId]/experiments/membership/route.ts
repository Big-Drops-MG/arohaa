import { NextResponse } from "next/server"
import {
  getActiveLandingPageForActor,
  type LandingPageRow,
} from "@/lib/server/landing-pages-store"
import {
  attachLandingPageAsVariant,
  getExperimentMembershipForLandingPage,
  leaveExperimentForLandingPage,
  renameVariantLabelForLandingPage,
} from "@/lib/server/experiments-store"
import { writeLandingPageAuditLog } from "@/lib/server/landing-audit-log"
import { route } from "@/lib/server/route"
import {
  experimentMembershipAttachBodySchema,
  experimentMembershipRenameBodySchema,
} from "@/lib/server/route-schemas"

async function requirePage(
  actorId: string,
  publicId: string
): Promise<LandingPageRow | null> {
  return getActiveLandingPageForActor(actorId, publicId)
}

export const GET = route(
  {
    permission: "landing_pages.read",
    actor: "read",
    tab: "experiments",
    rateLimit: "landing",
  },
  async ({ actor, params }) => {
    const landingPage = await requirePage(actor.id, params.publicId!)
    if (!landingPage) {
      return NextResponse.json({ error: "Not found" }, { status: 404 })
    }

    const data = await getExperimentMembershipForLandingPage(landingPage)
    return NextResponse.json(data)
  }
)

export const POST = route(
  {
    permission: "experiments.write",
    actor: "write",
    tab: "experiments",
    rateLimit: "landing",
    schema: experimentMembershipAttachBodySchema,
  },
  async ({ actor, params, body, request }) => {
    const landingPage = await requirePage(actor.id, params.publicId!)
    if (!landingPage) {
      return NextResponse.json({ error: "Not found" }, { status: 404 })
    }

    const parentPublicId = body.parentPublicId.trim()
    if (parentPublicId === landingPage.publicId) {
      return NextResponse.json(
        { error: "A project cannot be a variant of itself" },
        { status: 400 }
      )
    }

    const parent = await getActiveLandingPageForActor(actor.id, parentPublicId)
    if (!parent) {
      return NextResponse.json(
        { error: "Parent project not found" },
        { status: 404 }
      )
    }

    const attached = await attachLandingPageAsVariant({
      parent,
      child: landingPage,
      label: body.label,
    })
    if (!attached.ok) {
      return NextResponse.json(
        { error: attached.error },
        { status: attached.status ?? 409 }
      )
    }

    await writeLandingPageAuditLog({
      actorUserId: actor.id,
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
)

export const PATCH = route(
  {
    permission: "experiments.write",
    actor: "write",
    tab: "experiments",
    rateLimit: "landing",
    schema: experimentMembershipRenameBodySchema,
  },
  async ({ actor, params, body }) => {
    const landingPage = await requirePage(actor.id, params.publicId!)
    if (!landingPage) {
      return NextResponse.json({ error: "Not found" }, { status: 404 })
    }

    const renamed = await renameVariantLabelForLandingPage(
      landingPage,
      body.label
    )
    if (!renamed.ok) {
      return NextResponse.json(
        { error: renamed.error },
        { status: renamed.status ?? 400 }
      )
    }

    const data = await getExperimentMembershipForLandingPage(landingPage)
    return NextResponse.json(data)
  }
)

export const DELETE = route(
  {
    permission: "experiments.write",
    actor: "write",
    tab: "experiments",
    rateLimit: "landing",
  },
  async ({ actor, params, request }) => {
    const landingPage = await requirePage(actor.id, params.publicId!)
    if (!landingPage) {
      return NextResponse.json({ error: "Not found" }, { status: 404 })
    }

    const left = await leaveExperimentForLandingPage(landingPage)
    if (!left.ok) {
      return NextResponse.json(
        { error: left.error },
        { status: left.status ?? 400 }
      )
    }

    await writeLandingPageAuditLog({
      actorUserId: actor.id,
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
)
