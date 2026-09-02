import "server-only"

import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
  scryptSync,
} from "node:crypto"

const PREFIX = "enc:v1:"
const ALGORITHM = "aes-256-gcm"
const IV_BYTES = 12
const TAG_BYTES = 16

function deriveKey(): Buffer {
  const secret = process.env.TOTP_ENCRYPTION_KEY?.trim()
  if (!secret) {
    throw new Error("TOTP_ENCRYPTION_KEY is not configured.")
  }
  return scryptSync(secret, "arohaa-totp-v1", 32)
}

export function isEncryptedField(value: string | null | undefined): boolean {
  return Boolean(value?.startsWith(PREFIX))
}

export function encryptField(plaintext: string): string {
  if (!plaintext) return plaintext
  if (isEncryptedField(plaintext)) return plaintext

  const key = deriveKey()
  const iv = randomBytes(IV_BYTES)
  const cipher = createCipheriv(ALGORITHM, key, iv)
  const encrypted = Buffer.concat([
    cipher.update(plaintext, "utf8"),
    cipher.final(),
  ])
  const tag = cipher.getAuthTag()
  const payload = Buffer.concat([iv, tag, encrypted]).toString("base64url")
  return `${PREFIX}${payload}`
}

export function decryptField(stored: string | null | undefined): string | null {
  if (!stored) return null
  if (!isEncryptedField(stored)) return stored

  const payload = stored.slice(PREFIX.length)
  const buf = Buffer.from(payload, "base64url")
  if (buf.length <= IV_BYTES + TAG_BYTES) return null

  const iv = buf.subarray(0, IV_BYTES)
  const tag = buf.subarray(IV_BYTES, IV_BYTES + TAG_BYTES)
  const encrypted = buf.subarray(IV_BYTES + TAG_BYTES)

  const key = deriveKey()
  const decipher = createDecipheriv(ALGORITHM, key, iv)
  decipher.setAuthTag(tag)
  const decrypted = Buffer.concat([
    decipher.update(encrypted),
    decipher.final(),
  ])
  return decrypted.toString("utf8")
}

export function hashInviteToken(token: string): string {
  return createHash("sha256").update(token).digest("hex")
}
