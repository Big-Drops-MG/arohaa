import { NextResponse } from "next/server"
import { requireLandingPageActor } from "@/lib/server/landing-auth"
import { getActiveLandingPageForActor } from "@/lib/server/landing-pages-store"
import {
  createExperimentForLandingPage,
  getExperimentConfigForLandingPage,
} from "@/lib/server/experiments-store"
import { enforceLandingApiRateLimit } from "@/lib/server/rate-limit-landing"
import type { ExperimentVariantLink } from "@workspace/database"

export async function GET(
  _request: Request,
  props: { params: Promise<{ publicId: string }> }
) {
  const actor = await requireLandingPageActor()
  if (!actor) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }
  const limited = await enforceLandingApiRateLimit(actor.id)
  if (limited) return limited

  const { publicId } = await props.params
  const hub = await getActiveLandingPageForActor(actor.id, publicId)
  if (!hub) {
    return NextResponse.json({ error: "Not found" }, { status: 404 })
  }

  const data = await getExperimentConfigForLandingPage(hub)
  return NextResponse.json(data)
}

export async function POST(
  request: Request,
  props: { params: Promise<{ publicId: string }> }
) {
  const actor = await requireLandingPageActor()
  if (!actor) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }
  const limited = await enforceLandingApiRateLimit(actor.id)
  if (limited) return limited

  const { publicId } = await props.params
  const hub = await getActiveLandingPageForActor(actor.id, publicId)
  if (!hub) {
    return NextResponse.json({ error: "Not found" }, { status: 404 })
  }

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
  const variants = Array.isArray(record.variants)
    ? (record.variants as ExperimentVariantLink[])
    : undefined

  const result = await createExperimentForLandingPage(hub, {
    name: typeof record.name === "string" ? record.name : "",
    status: typeof record.status === "string" ? record.status : undefined,
    startDate:
      typeof record.startDate === "string" ? record.startDate : undefined,
    endDate:
      record.endDate === null
        ? null
        : typeof record.endDate === "string"
          ? record.endDate
          : undefined,
    noEndDate:
      typeof record.noEndDate === "boolean" ? record.noEndDate : undefined,
    variants,
    controlLandingPageId:
      record.controlLandingPageId === null
        ? null
        : typeof record.controlLandingPageId === "string"
          ? record.controlLandingPageId
          : undefined,
  })

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 400 })
  }

  const data = await getExperimentConfigForLandingPage(hub)
  return NextResponse.json(data, { status: 201 })
}
