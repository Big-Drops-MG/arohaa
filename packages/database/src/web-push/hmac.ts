import { createHmac, timingSafeEqual, randomBytes } from "node:crypto"
import {
  decryptVapidPrivateKey,
  encryptVapidPrivateKey,
} from "./crypto.js"

export function generateWebhookSecret(): string {
  return `wp_${randomBytes(24).toString("base64url")}`
}

export function encryptWebhookSecret(plain: string): string {
  return encryptVapidPrivateKey(plain)
}

export function decryptWebhookSecret(encrypted: string): string {
  return decryptVapidPrivateKey(encrypted)
}

export function signWebPushBody(secret: string, rawBody: string): string {
  return createHmac("sha256", secret).update(rawBody, "utf8").digest("hex")
}

export function verifyWebPushSignature(input: {
  secret: string
  rawBody: string
  signatureHeader: string | null | undefined
}): boolean {
  const header = (input.signatureHeader ?? "").trim()
  if (!header) return false

  let provided = header
  const shaMatch = /^sha256=(.+)$/i.exec(header)
  if (shaMatch) provided = shaMatch[1]!.trim()

  const expected = signWebPushBody(input.secret, input.rawBody)
  try {
    const a = Buffer.from(expected, "hex")
    const b = Buffer.from(provided, "hex")
    if (a.length !== b.length) return false
    return timingSafeEqual(a, b)
  } catch {
    return false
  }
}
