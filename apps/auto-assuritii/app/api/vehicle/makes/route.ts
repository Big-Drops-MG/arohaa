import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import { vehicleYears, vehicleMakes } from "@/lib/db/schema"
import { eq, asc } from "drizzle-orm"

export async function GET(request: NextRequest) {
  const yearParam = request.nextUrl.searchParams.get("year")
  if (!yearParam) {
    return NextResponse.json(
      { error: "Missing year query parameter" },
      { status: 400 }
    )
  }

  const year = parseInt(yearParam, 10)
  if (Number.isNaN(year)) {
    return NextResponse.json(
      { error: "Invalid year" },
      { status: 400 }
    )
  }

  try {
    const rows = await db
      .select({
        id: vehicleMakes.id,
        name: vehicleMakes.name,
      })
      .from(vehicleMakes)
      .innerJoin(
        vehicleYears,
        eq(vehicleMakes.yearId, vehicleYears.id)
      )
      .where(eq(vehicleYears.year, year))
      .orderBy(asc(vehicleMakes.name))

    const options = rows.map((row) => ({
      value: String(row.id),
      label: row.name,
    }))

    return NextResponse.json(options)
  } catch (error) {
    console.error("vehicle makes error:", error)
    return NextResponse.json(
      { error: "Failed to fetch makes" },
      { status: 500 }
    )
  }
}
