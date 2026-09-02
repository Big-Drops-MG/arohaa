"use server"

import { auth } from "@/auth"
import {
  db,
  normalizeUserEmail,
  users,
  whereUserEmail,
} from "@workspace/database"
import {
  isValidRoleName,
  normalizeRoleName,
} from "@/features/auth/model/role-options"
import {
  notifyApprovedUsersOfAccessRequest,
  setUserAccessStatus,
} from "@/lib/server/access-requests"
import { getMemberRoleId } from "@/lib/server/actor-can"
import { ensureRoleExists } from "@/lib/server/roles"

export async function completeOnboarding(formData: FormData): Promise<{
  error?: string
  success?: true
  redirectTo?: string
}> {
  const session = await auth()
  if (!session?.user?.email) return { error: "Not authenticated." }

  const firstNameRaw = formData.get("firstName")
  const lastNameRaw = formData.get("lastName")
  const roleRaw = formData.get("role")

  const firstName = typeof firstNameRaw === "string" ? firstNameRaw.trim() : ""
  const lastName = typeof lastNameRaw === "string" ? lastNameRaw.trim() : ""
  const roleInput = typeof roleRaw === "string" ? roleRaw : ""
  const jobTitle = normalizeRoleName(roleInput)

  if (!firstName || !lastName || !jobTitle) {
    return { error: "First name, last name, and role are required." }
  }

  if (!isValidRoleName(jobTitle)) {
    return { error: "Role must be between 2 and 80 characters." }
  }

  const email = normalizeUserEmail(session.user.email)
  const existing = await db.query.users.findFirst({
    where: whereUserEmail(email),
  })
  if (!existing) return { error: "User not found." }

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
    .where(whereUserEmail(email))

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
    requesterEmail: existing.email ?? email,
  })

  return { success: true, redirectTo: "/pending-access" }
}
