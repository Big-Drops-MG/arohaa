import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import { vehicleModels } from "@/lib/db/schema"
import { eq, asc } from "drizzle-orm"

export async function GET(request: NextRequest) {
  const makeIdParam = request.nextUrl.searchParams.get("makeId")
  if (!makeIdParam) {
    return NextResponse.json(
      { error: "Missing makeId query parameter" },
      { status: 400 }
    )
  }

  const makeId = parseInt(makeIdParam, 10)
  if (Number.isNaN(makeId)) {
    return NextResponse.json(
      { error: "Invalid makeId" },
      { status: 400 }
    )
  }

  try {
    const rows = await db
      .select({ id: vehicleModels.id, name: vehicleModels.name })
      .from(vehicleModels)
      .where(eq(vehicleModels.makeId, makeId))
      .orderBy(asc(vehicleModels.name))

    const options = rows.map((row) => ({
      value: row.name,
      label: row.name,
    }))

    return NextResponse.json(options)
  } catch (error) {
    console.error("vehicle models error:", error)
    return NextResponse.json(
      { error: "Failed to fetch models" },
      { status: 500 }
    )
  }
}
