"use server"

import { revalidatePath } from "next/cache"
import { db, users } from "@workspace/database"
import { eq } from "drizzle-orm"
import { isCeoRole } from "@/features/auth/model/role-options"
import { setUserAccessStatus } from "@/lib/server/access-requests"
import { isApprovedAccess } from "@/lib/server/access-status"
import { sendAccessRequestDecisionEmail } from "@/lib/server/email/send-access-email"
import { requireLandingPageActor } from "@/lib/server/landing-auth"

export async function acceptAccessRequest(
  userId: string
): Promise<{ error?: string; success?: true }> {
  return reviewAccessRequest(userId, "accepted")
}

export async function rejectAccessRequest(
  userId: string
): Promise<{ error?: string; success?: true }> {
  return reviewAccessRequest(userId, "rejected")
}

async function reviewAccessRequest(
  userId: string,
  decision: "accepted" | "rejected"
): Promise<{ error?: string; success?: true }> {
  const actor = await requireLandingPageActor()
  if (
    !actor ||
    !isApprovedAccess(actor.accessStatus) ||
    !isCeoRole(actor.role)
  ) {
    return { error: "Only the CEO can accept or reject access requests." }
  }

  const targetId = typeof userId === "string" ? userId.trim() : ""
  if (!targetId) return { error: "Invalid request." }
  if (targetId === actor.id) {
    return { error: "You cannot review your own access." }
  }

  const target = await db.query.users.findFirst({
    where: eq(users.id, targetId),
  })
  if (!target) return { error: "User not found." }
  if (target.accessStatus !== "pending") {
    return { error: "This request is no longer pending." }
  }
  if (
    !target.firstName?.trim() ||
    !target.lastName?.trim() ||
    !target.role?.trim()
  ) {
    return { error: "Profile is incomplete." }
  }

  const status = decision === "accepted" ? "approved" : "rejected"
  await setUserAccessStatus({
    userId: target.id,
    status,
    reviewedByUserId: actor.id,
  })

  const email = target.email?.trim()
  if (email) {
    void sendAccessRequestDecisionEmail({
      to: email,
      recipientFirstName: target.firstName?.trim() || undefined,
      decision,
    })
  }

  revalidatePath("/dashboard/team")
  return { success: true }
}
