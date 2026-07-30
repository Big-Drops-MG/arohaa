import { NextResponse } from "next/server"
import {
  createSegmentDefinition,
  listSegmentDefinitions,
} from "@/lib/server/segment-definitions-store"

export async function GET(
  _request: Request,
  props: { params: Promise<{ publicId: string }> }
) {
  const { publicId } = await props.params
  const result = await listSegmentDefinitions(publicId)

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status })
  }

  return NextResponse.json(result.data)
}

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

  const record = body as Record<string, unknown>
  const name = typeof record.name === "string" ? record.name.trim() : ""
  if (!name || !record.conditions) {
    return NextResponse.json(
      { error: "name and conditions are required" },
      { status: 400 }
    )
  }

  const result = await createSegmentDefinition(publicId, {
    name,
    description:
      typeof record.description === "string" && record.description.trim()
        ? record.description.trim()
        : undefined,
    conditions: record.conditions,
  })

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status })
  }

  return NextResponse.json(result.data, { status: 201 })
}
