"use server"

import { redirect } from "next/navigation"

export type SubmitResetPasswordResult = { error: string }

export async function submitResetPasswordAttempt(input: {
  code: string
  newPassword: string
  confirmPassword: string
}): Promise<SubmitResetPasswordResult | void> {
  const code = input.code.trim()
  const { newPassword, confirmPassword } = input

  if (newPassword.length < 8) {
    return { error: "Password must be at least 8 characters." }
  }
  if (newPassword !== confirmPassword) {
    return { error: "Passwords do not match." }
  }
  if (code.length !== 6) {
    return { error: "Enter the full 6-digit code." }
  }

  const devPlaceholder = process.env.DEV_PASSWORD_RESET_OTP?.trim()
  const codeAcceptedInDevOnly =
    process.env.NODE_ENV !== "production" &&
    devPlaceholder?.length === 6 &&
    code === devPlaceholder

  if (!codeAcceptedInDevOnly) {
    return { error: "That code did not match. Please try again." }
  }

  redirect("/reset-password/success")
}
