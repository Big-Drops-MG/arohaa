"use server"

import bcrypt from "bcryptjs"
import { z } from "zod"
import { db, users } from "@workspace/database"
import { eq } from "drizzle-orm"
import { requireLandingPageActor } from "@/lib/server/landing-auth"

const profileSchema = z.object({
  firstName: z.string().trim().min(1).max(80),
  lastName: z.string().trim().min(1).max(80),
  image: z.string().optional(),
})

const passwordSchema = z
  .object({
    currentPassword: z.string().min(1),
    newPassword: z.string().trim().min(8).max(200),
    confirmPassword: z.string().trim().min(8).max(200),
  })
  .refine((value) => value.newPassword === value.confirmPassword, {
    message: "New passwords do not match.",
    path: ["confirmPassword"],
  })

function parseOptionalImageUrl(value: unknown): string | null {
  if (value == null) return null
  const raw = typeof value === "string" ? value.trim() : ""
  if (!raw) return null

  try {
    const url = new URL(raw)
    if (url.protocol !== "http:" && url.protocol !== "https:") {
      return null
    }
    return url.toString()
  } catch {
    return null
  }
}

export async function updateProfile(formData: FormData): Promise<{
  error?: string
  success?: true
}> {
  const actor = await requireLandingPageActor()
  if (!actor) {
    return { error: "Not authenticated." }
  }

  const parsed = profileSchema.safeParse({
    firstName: formData.get("firstName"),
    lastName: formData.get("lastName"),
    image: formData.get("image") ?? "",
  })
  if (!parsed.success) {
    return { error: "First name and last name are required." }
  }

  const { firstName, lastName } = parsed.data

  const imageInput = parsed.data.image?.trim() ?? ""
  const image = imageInput ? parseOptionalImageUrl(imageInput) : null

  if (imageInput && !image) {
    return { error: "Profile image must be a valid http or https URL." }
  }

  await db
    .update(users)
    .set({
      firstName,
      lastName,
      image,
    })
    .where(eq(users.id, actor.id))

  return { success: true }
}

export async function changeProfilePassword(input: {
  currentPassword: string
  newPassword: string
  confirmPassword: string
}): Promise<{ error?: string; success?: true }> {
  const actor = await requireLandingPageActor()
  if (!actor) {
    return { error: "Not authenticated." }
  }

  const parsed = passwordSchema.safeParse(input)
  if (!parsed.success) {
    const message = parsed.error.issues[0]?.message
    return { error: message ?? "Invalid password change request." }
  }
  const { currentPassword, newPassword } = parsed.data

  const user = await db.query.users.findFirst({
    where: eq(users.id, actor.id),
  })

  if (!user?.password) {
    return {
      error: "Password change is not available for this sign-in method.",
    }
  }

  const matches = await bcrypt.compare(currentPassword, user.password)
  if (!matches) {
    return { error: "Current password is incorrect." }
  }

  const hashed = await bcrypt.hash(newPassword, 12)

  await db.update(users).set({ password: hashed }).where(eq(users.id, actor.id))

  const { invalidateAllSessionsForUser } =
    await import("@/lib/server/session-revocation")
  await invalidateAllSessionsForUser(user.id)

  const { signOut } = await import("@/auth")
  await signOut({ redirect: false })

  return { success: true }
}
