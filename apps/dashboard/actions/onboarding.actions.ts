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
  countApprovedUsers,
  notifyApprovedUsersOfAccessRequest,
  setUserAccessStatus,
} from "@/lib/server/access-requests"
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
  const role = normalizeRoleName(roleInput)

  if (!firstName || !lastName || !role) {
    return { error: "First name, last name, and role are required." }
  }

  if (!isValidRoleName(role)) {
    return { error: "Role must be between 2 and 80 characters." }
  }

  const email = normalizeUserEmail(session.user.email)
  const existing = await db.query.users.findFirst({
    where: whereUserEmail(email),
  })
  if (!existing) return { error: "User not found." }

  let savedRole: string
  try {
    savedRole = await ensureRoleExists(role)
  } catch {
    return { error: "Could not save role. Please try again." }
  }

  await db
    .update(users)
    .set({ firstName, lastName, role: savedRole })
    .where(whereUserEmail(email))

  const approvedCount = await countApprovedUsers()
  const isBootstrap = approvedCount === 0
  const alreadyApproved = existing.accessStatus === "approved"

  if (isBootstrap || alreadyApproved) {
    if (!alreadyApproved) {
      await setUserAccessStatus({
        userId: existing.id,
        status: "approved",
        reviewedByUserId: existing.id,
      })
    }
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
