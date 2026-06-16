"use server"

import { auth } from "@/auth"
import bcrypt from "bcryptjs"
import {
  db,
  normalizeUserEmail,
  users,
  whereUserEmail,
} from "@workspace/database"

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
  const session = await auth()
  if (!session?.user?.email) {
    return { error: "Not authenticated." }
  }

  const firstNameRaw = formData.get("firstName")
  const lastNameRaw = formData.get("lastName")
  const imageRaw = formData.get("image")

  const firstName = typeof firstNameRaw === "string" ? firstNameRaw.trim() : ""
  const lastName = typeof lastNameRaw === "string" ? lastNameRaw.trim() : ""

  if (!firstName || !lastName) {
    return { error: "First name and last name are required." }
  }

  if (firstName.length > 80 || lastName.length > 80) {
    return { error: "Name fields must be 80 characters or fewer." }
  }

  const imageInput = typeof imageRaw === "string" ? imageRaw.trim() : ""
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
    .where(whereUserEmail(normalizeUserEmail(session.user.email)))

  return { success: true }
}

export async function changeProfilePassword(input: {
  currentPassword: string
  newPassword: string
  confirmPassword: string
}): Promise<{ error?: string; success?: true }> {
  const session = await auth()
  if (!session?.user?.email) {
    return { error: "Not authenticated." }
  }

  const currentPassword = input.currentPassword
  const newPassword = input.newPassword.trim()
  const confirmPassword = input.confirmPassword.trim()

  if (!currentPassword) {
    return { error: "Current password is required." }
  }

  if (newPassword.length < 8) {
    return { error: "New password must be at least 8 characters." }
  }

  if (newPassword !== confirmPassword) {
    return { error: "New passwords do not match." }
  }

  const user = await db.query.users.findFirst({
    where: whereUserEmail(normalizeUserEmail(session.user.email)),
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

  await db
    .update(users)
    .set({ password: hashed })
    .where(whereUserEmail(normalizeUserEmail(session.user.email)))

  return { success: true }
}
