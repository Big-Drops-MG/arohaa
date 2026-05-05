"use server"

import { auth } from "@/auth"
import {
  db,
  normalizeUserEmail,
  users,
  whereUserEmail,
} from "@workspace/database"
import {
  ROLE_OPTIONS,
  type RoleOption,
} from "@/features/auth/model/role-options"

function isValidRole(role: string): role is RoleOption {
  return ROLE_OPTIONS.includes(role as RoleOption)
}

export async function completeOnboarding(formData: FormData): Promise<{
  error?: string
  success?: true
}> {
  const session = await auth()
  if (!session?.user?.email) return { error: "Not authenticated." }

  const firstNameRaw = formData.get("firstName")
  const lastNameRaw = formData.get("lastName")
  const roleRaw = formData.get("role")

  const firstName = typeof firstNameRaw === "string" ? firstNameRaw.trim() : ""
  const lastName = typeof lastNameRaw === "string" ? lastNameRaw.trim() : ""
  const role = typeof roleRaw === "string" ? roleRaw.trim() : ""

  if (!firstName || !lastName || !role) {
    return { error: "First name, last name, and role are required." }
  }

  if (!isValidRole(role)) {
    return { error: "Please select a valid role." }
  }

  await db
    .update(users)
    .set({ firstName, lastName, role })
    .where(whereUserEmail(normalizeUserEmail(session.user.email)))

  return { success: true }
}
