"use server"

import { AuthError } from "next-auth"
import bcrypt from "bcryptjs"
import { signIn, signOut, auth } from "../auth"
import { db, normalizeUserEmail, whereUserEmail } from "@workspace/database"
import { verifySync } from "otplib"
import { cookies } from "next/headers"

export type LoginWithCredentialsResult =
  | { requiresTwoFactor: true }
  | { error: string }
  | { redirectTo: string }

export async function verifyTwoFactorCode(
  code: string
): Promise<{ error?: string; success?: boolean }> {
  const session = await auth()
  if (!session?.user?.email) {
    return { error: "Not authenticated." }
  }

  const userRow = await db.query.users.findFirst({
    where: whereUserEmail(session.user.email),
  })

  if (!userRow || !userRow.twoFactorSecret) {
    return { error: "2FA is not set up properly." }
  }

  const isValid = verifySync({
    token: code,
    secret: userRow.twoFactorSecret,
    epochTolerance: 90,
  }).valid

  if (!isValid) {
    return { error: "Invalid authenticator code." }
  }

  ;(await cookies()).set("arohaa_2fa_verified", "true", {
    secure: process.env.NODE_ENV === "production",
    httpOnly: true,
    sameSite: "lax",
    path: "/",
  })

  return { success: true }
}

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

  const existingUser = await db.query.users.findFirst({
    where: whereUserEmail(email),
  })

  if (
    existingUser?.password &&
    existingUser.isTwoFactorEnabled &&
    (await bcrypt.compare(password, existingUser.password))
  ) {
    if (!code) {
      return { requiresTwoFactor: true }
    }

    if (!existingUser.twoFactorSecret) {
      return { error: "2FA is not set up properly." }
    }

    const isValid = verifySync({
      token: code,
      secret: existingUser.twoFactorSecret,
      epochTolerance: 90,
    }).valid

    if (!isValid) {
      return { error: "Invalid authenticator code." }
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
            error: "Invalid credentials.",
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

  if (userRow.isTwoFactorEnabled) {
    ;(await cookies()).set("arohaa_2fa_verified", "true", {
      secure: process.env.NODE_ENV === "production",
      httpOnly: true,
      sameSite: "lax",
      path: "/",
    })
    return { redirectTo: "/dashboard" }
  } else {
    return { redirectTo: "/authenticate" }
  }
}

export async function loginWithGoogle() {
  await signIn("google", { redirectTo: "/dashboard" })
}

export async function logout() {
  ;(await cookies()).delete("arohaa_2fa_verified")
  await signOut({ redirectTo: "/login" })
}
