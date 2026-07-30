import { NextResponse } from "next/server"
import { deleteSegmentDefinition } from "@/lib/server/segment-definitions-store"

export async function DELETE(
  _request: Request,
  props: { params: Promise<{ publicId: string; segmentId: string }> }
) {
  const { publicId, segmentId } = await props.params
  const result = await deleteSegmentDefinition(publicId, segmentId)

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status })
  }

  return NextResponse.json(result.data)
}
