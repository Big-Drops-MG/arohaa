import { OTP_LENGTH, sanitizeOtp } from "../model/otp"

export function resolveOtpDigits(valueFromInput: string): string {
  return sanitizeOtp(valueFromInput)
}

export function shouldAutoSubmitOtp(
  code: string,
  options?: {
    enabled?: boolean
    ready?: boolean
  }
): boolean {
  if (options?.enabled === false) return false
  if (options?.ready === false) return false
  return sanitizeOtp(code).length === OTP_LENGTH
}
