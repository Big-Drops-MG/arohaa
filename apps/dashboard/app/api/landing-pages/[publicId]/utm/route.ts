import { NextResponse } from "next/server"
import type { UtmParamItem } from "@/features/utm/model/utm"
import {
  loadUtmDashboardDataForApi,
  updateUtmParamsForLandingPage,
} from "@/lib/server/utm-dashboard-load"

export async function GET(
  _request: Request,
  props: { params: Promise<{ publicId: string }> }
) {
  const { publicId } = await props.params
  const res = await loadUtmDashboardDataForApi(publicId)

  if (!res.ok) {
    return NextResponse.json({ error: res.error }, { status: res.status })
  }

  return NextResponse.json(res.data)
}

export async function PUT(
  request: Request,
  props: { params: Promise<{ publicId: string }> }
) {
  const { publicId } = await props.params
  const body = (await request.json().catch(() => null)) as {
    items?: UtmParamItem[]
  } | null

  const res = await updateUtmParamsForLandingPage({
    landingPagePublicId: publicId,
    items: body?.items ?? [],
  })

  if (!res.ok) {
    return NextResponse.json({ error: res.error }, { status: res.status })
  }

  return NextResponse.json(res.data)
}
