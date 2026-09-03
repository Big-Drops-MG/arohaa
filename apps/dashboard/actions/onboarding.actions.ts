"use server"

import { z } from "zod"
import { eq } from "drizzle-orm"
import { db, users } from "@workspace/database"
import {
  isValidRoleName,
  normalizeRoleName,
} from "@/features/auth/model/role-options"
import {
  notifyApprovedUsersOfAccessRequest,
  setUserAccessStatus,
} from "@/lib/server/access-requests"
import { getMemberRoleId } from "@/lib/server/actor-can"
import { requireTwoFactorVerifiedUser } from "@/lib/server/landing-auth"
import { ensureRoleExists } from "@/lib/server/roles"

const onboardingSchema = z.object({
  firstName: z.string().trim().min(1).max(80),
  lastName: z.string().trim().min(1).max(80),
  role: z.string().trim().min(2).max(80),
})

export async function completeOnboarding(formData: FormData): Promise<{
  error?: string
  success?: true
  redirectTo?: string
}> {
  const existing = await requireTwoFactorVerifiedUser()
  if (!existing) return { error: "Not authenticated." }

  const parsed = onboardingSchema.safeParse({
    firstName: formData.get("firstName"),
    lastName: formData.get("lastName"),
    role: formData.get("role"),
  })
  if (!parsed.success) {
    return { error: "First name, last name, and role are required." }
  }

  const { firstName, lastName, role } = parsed.data
  const jobTitle = normalizeRoleName(role)

  if (!isValidRoleName(jobTitle)) {
    return { error: "Role must be between 2 and 80 characters." }
  }

  const profileComplete =
    Boolean(existing.firstName?.trim()) &&
    Boolean(existing.lastName?.trim()) &&
    Boolean(existing.roleId)
  if (profileComplete) {
    return { error: "Profile is already complete." }
  }

  let savedJobTitle: string
  try {
    savedJobTitle = await ensureRoleExists(jobTitle)
  } catch {
    return { error: "Could not save role. Please try again." }
  }

  const memberRoleId = existing.roleId ?? (await getMemberRoleId())

  await db
    .update(users)
    .set({
      firstName,
      lastName,
      role: savedJobTitle,
      roleId: memberRoleId,
    })
    .where(eq(users.id, existing.id))

  if (existing.accessStatus === "approved") {
    return { success: true, redirectTo: "/dashboard" }
  }

  if (existing.accessStatus !== "pending") {
    await setUserAccessStatus({
      userId: existing.id,
      status: "pending",
      reviewedByUserId: null,
    })
  }

  const requesterName = `${firstName} ${lastName}`.trim()
  void notifyApprovedUsersOfAccessRequest({
    requesterUserId: existing.id,
    requesterName,
    requesterEmail: existing.email ?? "",
  })

  return { success: true, redirectTo: "/pending-access" }
}
