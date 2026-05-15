import { NextResponse } from "next/server"
import { db } from "@/lib/db"
import { vehicleYears } from "@/lib/db/schema"
import { desc } from "drizzle-orm"

export async function GET() {
  try {
    const rows = await db
      .select({ year: vehicleYears.year })
      .from(vehicleYears)
      .orderBy(desc(vehicleYears.year))

    const options = rows.map((row) => ({
      value: String(row.year),
      label: String(row.year),
    }))

    return NextResponse.json(options)
  } catch (error) {
    console.error("vehicle years error:", error)
    return NextResponse.json(
      { error: "Failed to fetch years" },
      { status: 500 }
    )
  }
}
