function toE164(phone: string, defaultCountry = "US"): string {
  const digits = String(phone).replace(/\D/g, "")
  if (defaultCountry === "US") {
    if (digits.length === 10) return `+1${digits}`
    if (digits.length === 11 && digits.startsWith("1")) return `+${digits}`
  }
  return digits ? `+${digits}` : ""
}

export async function verifyPhone(
  phone: string,
  key: string,
  defaultCountry = "US"
): Promise<{ valid: boolean; error?: string }> {
  const e164 = toE164(phone, defaultCountry)
  if (!e164) return { valid: false, error: "Invalid phone number" }
  const url = new URL("https://api.veriphone.io/v2/verify")
  url.searchParams.set("key", key)
  url.searchParams.set("phone", e164)
  url.searchParams.set("default_country", defaultCountry)
  try {
    const res = await fetch(url.toString(), { method: "GET", cache: "no-store" })
    const data = (await res.json().catch(() => ({}))) as {
      message?: string
      phone_valid?: boolean
    }
    if (res.status !== 200) {
      return { valid: false, error: data.message ?? "Phone verification failed" }
    }
    const valid = data.phone_valid === true
    return { valid, error: valid ? undefined : "Please enter a valid phone number" }
  } catch (e) {
    console.error("[veriphone] error:", e)
    return { valid: false, error: "Phone verification unavailable" }
  }
}
