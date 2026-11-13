import { NextResponse } from "next/server"
import { parseDashboardCustomRange } from "@/features/traffic/model/traffic-range"
import { parseUtmFilterFromSearchParams } from "@/lib/server/analytics-utm-params"
import {
  ingestCallCenterCsv,
  loadCallCenterOutcomes,
} from "@/lib/server/call-center-outcomes-load"
import { route } from "@/lib/server/route"
import { MAX_DASHBOARD_CUSTOM_SPAN_DAYS } from "@/lib/server/route-query"

export const GET = route(
  {
    permission: "landing_pages.read",
    actor: "read",
    tab: "data-lab",
    section: "leads",
    rateLimit: "landing",
    query: {
      maxCustomRangeDays: MAX_DASHBOARD_CUSTOM_SPAN_DAYS,
    },
  },
  async ({ params, request }) => {
    const { searchParams } = new URL(request.url)
    const res = await loadCallCenterOutcomes(
      params.publicId!,
      searchParams.get("range_id"),
      parseDashboardCustomRange(
        searchParams.get("from"),
        searchParams.get("to")
      ),
      parseUtmFilterFromSearchParams(searchParams)
    )
    if (!res.ok) {
      return NextResponse.json({ error: res.error }, { status: res.status })
    }
    return NextResponse.json(res.data)
  }
)

export const POST = route(
  {
    permission: "landing_pages.read",
    actor: "write",
    tab: "data-lab",
    section: "leads",
    rateLimit: "landing",
  },
  async ({ params, request }) => {
    const form = await request.formData()
    const file = form.get("file")
    if (!(file instanceof File)) {
      return NextResponse.json({ error: "Missing CSV file." }, { status: 400 })
    }
    if (!file.name.toLowerCase().endsWith(".csv")) {
      return NextResponse.json(
        { error: "Only .csv files are supported." },
        { status: 400 }
      )
    }

    const buffer = Buffer.from(await file.arrayBuffer())
    const csvText = buffer.toString("utf8")
    const res = await ingestCallCenterCsv({
      landingPagePublicId: params.publicId!,
      fileName: file.name,
      csvText,
      byteLength: buffer.byteLength,
    })

    if (!res.ok) {
      return NextResponse.json({ error: res.error }, { status: res.status })
    }
    return NextResponse.json(res.data)
  }
)
