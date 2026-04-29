"use server"

import { auth } from "@/auth"
import {
  db,
  normalizeUserEmail,
  users,
  whereUserEmail,
} from "@workspace/database"
import { generateSecret, generateURI, verifySync } from "otplib"
import QRCode from "qrcode"

export async function generateOTPSetup() {
  const session = await auth()
  if (!session?.user?.email) throw new Error("Not authenticated")

  const enrolledEmail = normalizeUserEmail(session.user.email)

  const row = await db.query.users.findFirst({
    where: whereUserEmail(enrolledEmail),
  })

  if (!row) {
    throw new Error("User not found")
  }

  let secret: string
  if (row.pendingTwoFactorSecret && !row.isTwoFactorEnabled) {
    secret = row.pendingTwoFactorSecret
  } else {
    secret = generateSecret()
    await db
      .update(users)
      .set({ pendingTwoFactorSecret: secret })
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

export type VerifyOTPResult = { success: true } | { error: string }

export async function verifyAndEnableOTP(
  token: string
): Promise<VerifyOTPResult> {
  const session = await auth()
  if (!session?.user?.email) return { error: "Not authenticated" }

  const enrolledEmail = normalizeUserEmail(session.user.email)
  const normalized = token.replace(/\D/g, "").slice(0, 6)

  const row = await db.query.users.findFirst({
    where: whereUserEmail(enrolledEmail),
  })

  if (!row?.pendingTwoFactorSecret) {
    return {
      error:
        "No QR enrollment for this login. Refresh this page and scan the code shown here.",
    }
  }

  if (normalized.length !== 6) {
    return { error: "Enter all 6 digits from your authenticator app." }
  }

  const ok = verifySync({
    secret: row.pendingTwoFactorSecret,
    token: normalized,
    epochTolerance: 90,
  }).valid

  if (!ok) {
    return {
      error:
        "Invalid code. Use the 6-digit code for the account labeled with your registered email.",
    }
  }

  await db
    .update(users)
    .set({
      isTwoFactorEnabled: true,
      twoFactorSecret: row.pendingTwoFactorSecret,
      pendingTwoFactorSecret: null,
    })
    .where(whereUserEmail(enrolledEmail))

  return { success: true }
}
