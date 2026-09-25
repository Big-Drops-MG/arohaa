const IV_LEN = 12

function b64ToBytes(b64: string): Uint8Array {
  const bin = atob(b64)
  const out = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i)
  return out
}

function bytesToB64(bytes: Uint8Array): string {
  let bin = ""
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]!)
  return btoa(bin)
}

async function importAesKey(keyB64: string): Promise<CryptoKey | null> {
  if (typeof crypto === "undefined" || !crypto.subtle) return null
  try {
    const raw = b64ToBytes(keyB64)
    if (raw.length !== 32) return null
    const copy = raw.buffer.slice(
      raw.byteOffset,
      raw.byteOffset + raw.byteLength,
    ) as ArrayBuffer
    return await crypto.subtle.importKey(
      "raw",
      copy,
      { name: "AES-GCM" },
      false,
      ["encrypt"],
    )
  } catch {
    return null
  }
}

export async function sealJson(
  keyB64: string,
  value: unknown,
): Promise<string | null> {
  const key = await importAesKey(keyB64)
  if (!key) return null
  try {
    const iv = crypto.getRandomValues(new Uint8Array(IV_LEN))
    const plaintext = new TextEncoder().encode(JSON.stringify(value))
    const sealed = new Uint8Array(
      await crypto.subtle.encrypt(
        { name: "AES-GCM", iv: iv as BufferSource },
        key,
        plaintext as BufferSource,
      ),
    )
    const out = new Uint8Array(IV_LEN + sealed.length)
    out.set(iv, 0)
    out.set(sealed, IV_LEN)
    return bytesToB64(out)
  } catch {
    return null
  }
}
