const OPAQUE_PROP_KEY = "_k"

let blobKeyBytes: Uint8Array | null = null

export function setFieldBlobKeyFromB64(b64: string | null | undefined): void {
  if (!b64 || typeof b64 !== "string") {
    blobKeyBytes = null
    return
  }
  try {
    const bin = atob(b64)
    const bytes = new Uint8Array(bin.length)
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i)
    blobKeyBytes = bytes.length === 32 ? bytes : null
  } catch {
    blobKeyBytes = null
  }
}

export function hasFieldBlobKey(): boolean {
  return blobKeyBytes !== null
}

function bytesToB64(bytes: Uint8Array): string {
  let s = ""
  for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]!)
  return btoa(s)
}

export async function encryptFieldsForWire(
  fields: Record<string, string>,
): Promise<Record<string, string> | null> {
  if (!blobKeyBytes || typeof crypto === "undefined" || !crypto.subtle) {
    return null
  }
  try {
    const iv = crypto.getRandomValues(new Uint8Array(12))
    const key = await crypto.subtle.importKey(
      "raw",
      blobKeyBytes.slice().buffer,
      { name: "AES-GCM" },
      false,
      ["encrypt"],
    )
    const plaintext = new TextEncoder().encode(JSON.stringify(fields))
    const cipherBuf = await crypto.subtle.encrypt(
      { name: "AES-GCM", iv },
      key,
      plaintext,
    )
    const cipher = new Uint8Array(cipherBuf)
    const packed = new Uint8Array(iv.length + cipher.length)
    packed.set(iv, 0)
    packed.set(cipher, iv.length)
    return { [OPAQUE_PROP_KEY]: bytesToB64(packed) }
  } catch {
    return null
  }
}

export { OPAQUE_PROP_KEY }
