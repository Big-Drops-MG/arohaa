import { NextResponse } from "next/server"
import { previewSegmentDefinition } from "@/lib/server/segment-definitions-store"

export async function POST(
  request: Request,
  props: { params: Promise<{ publicId: string }> }
) {
  const { publicId } = await props.params

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 })
  }
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 })
  }

  const { conditions } = body as Record<string, unknown>
  if (!conditions) {
    return NextResponse.json(
      { error: "conditions are required" },
      { status: 400 }
    )
  }

  const result = await previewSegmentDefinition(publicId, conditions)

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status })
  }

  return NextResponse.json(result.data)
}
