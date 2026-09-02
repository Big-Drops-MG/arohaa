"use server"

import { AuthError } from "next-auth"
import bcrypt from "bcryptjs"
import { signIn, signOut, auth, unstable_update } from "../auth"
import { db, normalizeUserEmail, whereUserEmail } from "@workspace/database"
import {
  authGenericError,
  enforceAuthRateLimit,
} from "@/lib/server/rate-limit-auth"
import { clientIpFromNextHeaders } from "@/lib/server/request-client-meta"
import { DUMMY_PASSWORD_HASH } from "@/lib/server/auth-timing"
import {
  consumeTotp,
  issueTwoFactorSessionStamp,
  pruneUsedTotp,
} from "@/lib/server/totp"
import { readTotpSecretFromRow } from "@/lib/server/totp-secrets"

export type LoginWithCredentialsResult =
  | { requiresTwoFactor: true }
  | { error: string }
  | { redirectTo: string }

export async function verifyTwoFactorCode(
  code: string
): Promise<{ error?: string; success?: boolean; redirectTo?: string }> {
  const session = await auth()
  if (!session?.user?.email) {
    return { error: "Not authenticated." }
  }

  const limited = await enforceAuthRateLimit({
    ip: (await clientIpFromNextHeaders()) ?? "unknown",
    email: session.user.email,
  })
  if (limited) return { error: limited.error }

  const userRow = await db.query.users.findFirst({
    where: whereUserEmail(normalizeUserEmail(session.user.email)),
  })

  if (!userRow?.isTwoFactorEnabled || !userRow.twoFactorSecret) {
    return { error: authGenericError() }
  }

  const secret = await readTotpSecretFromRow(
    userRow.id,
    userRow,
    "twoFactorSecret"
  )
  if (!secret) {
    return { error: authGenericError() }
  }

  const digits = code.replace(/\D/g, "").slice(0, 6)
  const ok = await consumeTotp(userRow.id, secret, digits)
  if (!ok) {
    return { error: authGenericError() }
  }

  const sessionJti = session.jti
  if (!sessionJti) {
    return { error: authGenericError() }
  }

  void pruneUsedTotp(userRow.id)
  await issueTwoFactorSessionStamp(userRow.id, sessionJti)
  await unstable_update({})

  const { touchUserLastSeen } = await import("@/lib/server/user-last-seen")
  void touchUserLastSeen(userRow.id)

  const { resolvePostAuthPath } = await import("@/lib/server/access-status")
  return { success: true, redirectTo: resolvePostAuthPath(userRow) }
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

  const limited = await enforceAuthRateLimit({
    ip: (await clientIpFromNextHeaders()) ?? "unknown",
    email,
  })
  if (limited) return { error: limited.error }

  const existingUser = await db.query.users.findFirst({
    where: whereUserEmail(email),
  })

  const passwordValid = await bcrypt.compare(
    password,
    existingUser?.password ?? DUMMY_PASSWORD_HASH
  )
  if (!passwordValid) {
    return { error: authGenericError() }
  }

  if (existingUser?.isTwoFactorEnabled && !code) {
    return { requiresTwoFactor: true }
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
      return { error: authGenericError() }
    }
    throw error
  }

  const userRow = await db.query.users.findFirst({
    where: whereUserEmail(email),
  })

  if (!userRow) {
    return { error: authGenericError() }
  }

  if (userRow.isTwoFactorEnabled) {
    const { resolvePostAuthPath } = await import("@/lib/server/access-status")
    return { redirectTo: resolvePostAuthPath(userRow) }
  }

  return { redirectTo: "/authenticate" }
}

export async function loginWithGoogle() {
  await signIn("google", { redirectTo: "/dashboard" })
}

export async function logout() {
  const session = await auth()
  if (session?.jti && session.user?.id) {
    const { revokeSessionJti } = await import("@/lib/server/session-revocation")
    await revokeSessionJti({ jti: session.jti, userId: session.user.id })
  }
  await signOut({ redirectTo: "/login" })
}
