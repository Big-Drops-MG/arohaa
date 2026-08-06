import type { NextRequest } from "next/server"
import { NextResponse } from "next/server"
import { eq } from "drizzle-orm"
import { db, users } from "@workspace/database"
import { requireLandingPageActor } from "@/lib/server/landing-auth"
import { listAuditLogsByActorUserId } from "@/lib/server/landing-audit-log"
import { enforceLandingApiRateLimit } from "@/lib/server/rate-limit-landing"

export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ userId: string }> }
) {
  const actor = await requireLandingPageActor()
  if (!actor) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }
  const limited = await enforceLandingApiRateLimit(actor.id)
  if (limited) return limited

  const { userId } = await context.params
  if (!userId?.trim()) {
    return NextResponse.json({ error: "Not found" }, { status: 404 })
  }

  const member = await db.query.users.findFirst({
    where: eq(users.id, userId),
    columns: {
      id: true,
      accessStatus: true,
      firstName: true,
      lastName: true,
      email: true,
    },
  })

  if (!member || member.accessStatus !== "approved") {
    return NextResponse.json({ error: "Not found" }, { status: 404 })
  }

  const items = await listAuditLogsByActorUserId(member.id)

  return NextResponse.json({
    member: {
      id: member.id,
      name:
        `${member.firstName?.trim() ?? ""} ${member.lastName?.trim() ?? ""}`.trim() ||
        member.email?.trim() ||
        "User",
      email: member.email,
    },
    items,
  })
}
