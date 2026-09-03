"use server"

import { auth, unstable_update } from "@/auth"
import {
  db,
  normalizeUserEmail,
  users,
  whereUserEmail,
} from "@workspace/database"
import { generateSecret, generateURI } from "otplib"
import QRCode from "qrcode"
import { encryptField } from "@/lib/server/field-encryption"
import {
  authGenericError,
  enforceAuthRateLimit,
} from "@/lib/server/rate-limit-auth"
import { clientIpFromNextHeaders } from "@/lib/server/request-client-meta"
import { readTotpSecretFromRow } from "@/lib/server/totp-secrets"
import { consumeTotp, issueTwoFactorSessionStamp } from "@/lib/server/totp"

export async function generateOTPSetup(params?: { stepUpCode?: string }) {
  const session = await auth()
  if (!session?.user?.email) throw new Error("Not authenticated")

  const enrolledEmail = normalizeUserEmail(session.user.email)

  const row = await db.query.users.findFirst({
    where: whereUserEmail(enrolledEmail),
  })

  if (!row) {
    throw new Error("User not found")
  }

  if (row.isTwoFactorEnabled) {
    const limited = await enforceAuthRateLimit({
      ip: (await clientIpFromNextHeaders()) ?? "unknown",
      email: enrolledEmail,
    })
    if (limited) {
      throw new Error(limited.error)
    }
    const stepUp = params?.stepUpCode?.replace(/\D/g, "").slice(0, 6) ?? ""
    const activeSecret = await readTotpSecretFromRow(
      row.id,
      row,
      "twoFactorSecret"
    )
    if (!activeSecret || !/^\d{6}$/.test(stepUp)) {
      throw new Error(
        "Authenticator is already enabled. Enter a current code to re-enroll."
      )
    }
    const ok = await consumeTotp(row.id, activeSecret, stepUp)
    if (!ok) {
      throw new Error("Invalid authenticator code.")
    }
  }

  let secret: string
  const pendingSecret = await readTotpSecretFromRow(
    row.id,
    row,
    "pendingTwoFactorSecret"
  )
  if (pendingSecret && !row.isTwoFactorEnabled) {
    secret = pendingSecret
  } else {
    secret = generateSecret()
    await db
      .update(users)
      .set({ pendingTwoFactorSecret: encryptField(secret) })
      .where(whereUserEmail(enrolledEmail))
  }

  const otpauthUrl = generateURI({
    issuer: "Arohaa Dashboard",
    label: enrolledEmail,
    secret,
  })

  const qrCodeDataUrl = await QRCode.toDataURL(otpauthUrl)

  return { qrCodeDataUrl, enrolledEmail }
}

export type VerifyOTPResult =
  | { success: true; redirectTo: string }
  | { error: string }

export async function verifyAndEnableOTP(
  token: string
): Promise<VerifyOTPResult> {
  const session = await auth()
  if (!session?.user?.email) return { error: "Not authenticated" }

  const enrolledEmail = normalizeUserEmail(session.user.email)
  const limited = await enforceAuthRateLimit({
    ip: (await clientIpFromNextHeaders()) ?? "unknown",
    email: enrolledEmail,
  })
  if (limited) return { error: limited.error }

  const normalized = token.replace(/\D/g, "").slice(0, 6)

  const row = await db.query.users.findFirst({
    where: whereUserEmail(enrolledEmail),
  })

  if (row?.isTwoFactorEnabled) {
    return {
      error:
        "Authenticator is already enabled. Sign out and use your existing code, or re-enroll with a step-up code.",
    }
  }

  const pendingSecret = row
    ? await readTotpSecretFromRow(row.id, row, "pendingTwoFactorSecret")
    : null

  if (!pendingSecret) {
    return {
      error:
        "No QR enrollment for this login. Refresh this page and scan the code shown here.",
    }
  }

  if (normalized.length !== 6) {
    return { error: "Enter all 6 digits from your authenticator app." }
  }

  const consumed = await consumeTotp(row!.id, pendingSecret, normalized)
  if (!consumed) {
    return { error: authGenericError() }
  }

  await db
    .update(users)
    .set({
      isTwoFactorEnabled: true,
      twoFactorSecret: encryptField(pendingSecret),
      pendingTwoFactorSecret: null,
    })
    .where(whereUserEmail(enrolledEmail))

  const sessionJti = session.jti
  if (!sessionJti) {
    return { error: "Session expired. Sign in again." }
  }

  await issueTwoFactorSessionStamp(row!.id, sessionJti)
  await unstable_update({})

  const { resolvePostAuthPath } = await import("@/lib/server/access-status")
  return { success: true, redirectTo: resolvePostAuthPath(row!) }
}
