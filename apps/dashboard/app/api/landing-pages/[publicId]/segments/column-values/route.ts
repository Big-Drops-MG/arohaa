import { NextResponse } from "next/server"
import { fetchSegmentColumnValues } from "@/lib/server/segment-definitions-store"

export async function GET(
  request: Request,
  props: { params: Promise<{ publicId: string }> }
) {
  const { publicId } = await props.params
  const column = new URL(request.url).searchParams.get("column")?.trim() ?? ""

  if (!column) {
    return NextResponse.json({ error: "column is required" }, { status: 400 })
  }

  const result = await fetchSegmentColumnValues(publicId, column)

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status })
  }

  return NextResponse.json(result.data)
}
