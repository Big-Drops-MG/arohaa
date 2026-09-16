import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto"

const ALGO = "aes-256-gcm"
const IV_LENGTH = 12

function resolveEncryptionKey(): Buffer {
  const raw =
    process.env.WEB_PUSH_VAPID_ENCRYPTION_KEY?.trim() ||
    process.env.AUTH_SECRET?.trim() ||
    process.env.NEXTAUTH_SECRET?.trim()
  if (!raw) {
    throw new Error(
      "Set WEB_PUSH_VAPID_ENCRYPTION_KEY (or AUTH_SECRET) to encrypt VAPID private keys."
    )
  }
  return createHash("sha256").update(raw).digest()
}

export function encryptVapidPrivateKey(plain: string): string {
  const key = resolveEncryptionKey()
  const iv = randomBytes(IV_LENGTH)
  const cipher = createCipheriv(ALGO, key, iv)
  const encrypted = Buffer.concat([
    cipher.update(plain, "utf8"),
    cipher.final(),
  ])
  const tag = cipher.getAuthTag()
  return `${iv.toString("base64url")}.${tag.toString("base64url")}.${encrypted.toString("base64url")}`
}

export function decryptVapidPrivateKey(payload: string): string {
  const [ivB64, tagB64, dataB64] = payload.split(".")
  if (!ivB64 || !tagB64 || !dataB64) {
    throw new Error("Invalid encrypted VAPID private key payload")
  }
  const key = resolveEncryptionKey()
  const decipher = createDecipheriv(
    ALGO,
    key,
    Buffer.from(ivB64, "base64url")
  )
  decipher.setAuthTag(Buffer.from(tagB64, "base64url"))
  const decrypted = Buffer.concat([
    decipher.update(Buffer.from(dataB64, "base64url")),
    decipher.final(),
  ])
  return decrypted.toString("utf8")
}

export function hashPushEndpoint(endpoint: string): string {
  return createHash("sha256").update(endpoint).digest("hex").slice(0, 32)
}
