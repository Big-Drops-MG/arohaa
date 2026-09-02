"use server"

import { revalidatePath } from "next/cache"
import type { Permission } from "@workspace/database"
import { requireLandingPageActor } from "@/lib/server/landing-auth"
import {
  assignRole as assignRoleInternal,
  updateRolePermissions as updateRolePermissionsInternal,
} from "@/lib/server/role-management"

export async function updateRolePermissionsAction(input: {
  roleId: string
  permissions: Permission[]
}): Promise<{ error?: string; success?: true }> {
  const actor = await requireLandingPageActor()
  if (!actor) return { error: "Unauthorized." }

  const result = await updateRolePermissionsInternal(
    actor,
    input.roleId,
    input.permissions
  )
  if (result.success) {
    revalidatePath("/dashboard/team")
  }
  return result
}

export async function assignRoleAction(input: {
  userId: string
  roleKey: string
}): Promise<{ error?: string; success?: true }> {
  const actor = await requireLandingPageActor()
  if (!actor) return { error: "Unauthorized." }

  const result = await assignRoleInternal(actor, input.userId, input.roleKey)
  if (result.success) {
    revalidatePath("/dashboard/team")
  }
  return result
}
