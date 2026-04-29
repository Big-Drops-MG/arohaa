"use server"

import { AuthError } from "next-auth"
import bcrypt from "bcryptjs"
import { signIn, signOut } from "../auth"
import { db, normalizeUserEmail, whereUserEmail } from "@workspace/database"

export type LoginWithCredentialsResult =
  | { requiresTwoFactor: true }
  | { error: string }
  | { redirectTo: string }

export async function loginWithCredentials(
  formData: FormData
): Promise<LoginWithCredentialsResult | void> {
  const emailRaw = formData.get("email")
  const passwordRaw = formData.get("password")
  const codeRaw = formData.get("code")

  const email = typeof emailRaw === "string" ? normalizeUserEmail(emailRaw) : ""
  const password = typeof passwordRaw === "string" ? passwordRaw : ""
  const code =
    typeof codeRaw === "string" && codeRaw.trim() ? codeRaw.trim() : null

  if (!email || !password) {
    return { error: "Email and password are required." }
  }

  if (!code) {
    const existingUser = await db.query.users.findFirst({
      where: whereUserEmail(email),
    })

    if (
      existingUser?.password &&
      existingUser.isTwoFactorEnabled &&
      (await bcrypt.compare(password, existingUser.password))
    ) {
      return { requiresTwoFactor: true }
    }
  }

  try {
    await signIn("credentials", {
      email,
      password,
      ...(code ? { code } : {}),
      redirect: false,
    })
  } catch (error) {
    if (error instanceof AuthError) {
      switch (error.type) {
        case "CredentialsSignin":
          return {
            error: "Invalid credentials or authenticator code.",
          }
        default:
          return { error: "Something went wrong." }
      }
    }
    throw error
  }

  const userRow = await db.query.users.findFirst({
    where: whereUserEmail(email),
  })

  if (!userRow) {
    return { error: "Invalid credentials or authenticator code." }
  }

  if (!userRow.isTwoFactorEnabled) {
    return { redirectTo: "/authenticate" }
  }

  return { redirectTo: "/dashboard" }
}

export async function loginWithGoogle() {
  await signIn("google", { redirectTo: "/dashboard" })
}

export async function logout() {
  await signOut({ redirectTo: "/login" })
}
