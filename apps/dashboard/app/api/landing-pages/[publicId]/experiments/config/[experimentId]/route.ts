import { NextResponse } from "next/server"
import { getActiveLandingPageForActor } from "@/lib/server/landing-pages-store"
import {
  deleteExperimentForLandingPage,
  getExperimentConfigForLandingPage,
  updateExperimentForLandingPage,
} from "@/lib/server/experiments-store"
import { getActorAccess } from "@/lib/server/external-access"
import { route } from "@/lib/server/route"
import { experimentUpdateBodySchema } from "@/lib/server/route-schemas"
import type { InferSelectModel, users } from "@workspace/database"

type UserRow = InferSelectModel<typeof users>

async function siblingOpts(actor: UserRow) {
  const access = await getActorAccess(actor)
  if (!access.isExternal)
    return { allowedPublicIds: null as Set<string> | null }
  return { allowedPublicIds: access.projectIds }
}

export const PATCH = route(
  {
    permission: "experiments.write",
    actor: "write",
    tab: "experiments",
    rateLimit: "landing",
    schema: experimentUpdateBodySchema,
  },
  async ({ actor, params, body }) => {
    const landingPage = await getActiveLandingPageForActor(
      actor.id,
      params.publicId!
    )
    if (!landingPage) {
      return NextResponse.json({ error: "Not found" }, { status: 404 })
    }

    const result = await updateExperimentForLandingPage(
      landingPage,
      params.experimentId!,
      {
        name: body.name,
        status: body.status,
        startDate: body.startDate,
        endDate: body.endDate,
        noEndDate: body.noEndDate,
        variants: body.variants,
        controlLandingPageId: body.controlLandingPageId,
      }
    )

    if (!result.ok) {
      return NextResponse.json(
        { error: result.error },
        { status: result.status ?? 400 }
      )
    }

    const data = await getExperimentConfigForLandingPage(
      landingPage,
      await siblingOpts(actor)
    )
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
  async ({ actor, params }) => {
    const landingPage = await getActiveLandingPageForActor(
      actor.id,
      params.publicId!
    )
    if (!landingPage) {
      return NextResponse.json({ error: "Not found" }, { status: 404 })
    }

    const result = await deleteExperimentForLandingPage(
      landingPage,
      params.experimentId!
    )
    if (!result.ok) {
      return NextResponse.json(
        { error: result.error },
        { status: result.status ?? 400 }
      )
    }

    return NextResponse.json({ ok: true })
  }
)
