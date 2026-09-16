/** HMAC-SHA256 hex digest (Web Crypto — works in browser, Edge, and Node 18+). */
export async function signWebPushBodyHex(
  secret: string,
  rawBody: string,
): Promise<string> {
  const enc = new TextEncoder()
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  )
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(rawBody))
  return Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("")
}

export async function webPushSignatureHeader(
  secret: string,
  rawBody: string,
): Promise<string> {
  const hex = await signWebPushBodyHex(secret, rawBody)
  return `sha256=${hex}`
}
