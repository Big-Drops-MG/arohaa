const HUNTER_EMAIL_VERIFIER_BASE = "https://api.hunter.io/v2/email-verifier"

const ACCEPTABLE_STATUSES = new Set([
  "valid",
  "webmail",
  "accept_all",
])

export type HunterVerifyResult =
  | { ok: true }
  | { ok: false; message: string }

function sleep(ms: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, ms))
}

function buildEmailVerifierUrl(email: string, apiKey: string): string {
  const url = new URL(HUNTER_EMAIL_VERIFIER_BASE)
  url.searchParams.set("email", email)
  url.searchParams.set("api_key", apiKey)
  return url.toString()
}

export async function verifyEmailWithHunter(email: string): Promise<HunterVerifyResult> {
  const trimmed = email.trim()
  const apiKey = process.env.HUNTER_API_KEY?.trim()

  if (!apiKey) {
    if (process.env.NODE_ENV === "development") {
      console.warn("[hunter] HUNTER_API_KEY is not set; skipping email verification")
    }
    return { ok: true }
  }

  const requestUrl = buildEmailVerifierUrl(trimmed, apiKey)

  let smtpRetries = 0
  let serverErrorRetries = 0

  for (let poll = 0; poll < 28; poll++) {
    const res = await fetch(requestUrl, { method: "GET", cache: "no-store" })

    if (res.status === 202) {
      await sleep(1000)
      continue
    }

    if (res.status === 222) {
      smtpRetries += 1
      if (smtpRetries > 4) {
        return {
          ok: false,
          message:
            "We could not complete email verification right now. Please try again in a moment.",
        }
      }
      await sleep(2000)
      continue
    }

    if (res.status === 451) {
      return {
        ok: false,
        message: "This email address cannot be used. Please try a different one.",
      }
    }

    if (res.status === 400) {
      let message = "Please enter a valid email address."
      try {
        const body = (await res.json()) as {
          errors?: Array<{ details?: string }>
        }
        const details = body.errors?.[0]?.details
        if (typeof details === "string" && details.trim()) message = details
      } catch {
        /* ignore */
      }
      return { ok: false, message }
    }

    if (res.status === 401 || res.status === 403 || res.status === 429) {
      return {
        ok: false,
        message:
          "Email verification is temporarily unavailable. Please try again in a few minutes.",
      }
    }

    if (res.status >= 500) {
      serverErrorRetries += 1
      if (serverErrorRetries <= 2) {
        await sleep(1500)
        continue
      }
      return {
        ok: false,
        message:
          "Email verification is temporarily unavailable. Please try again shortly.",
      }
    }

    if (!res.ok) {
      return {
        ok: false,
        message: "Email verification failed. Please try again.",
      }
    }

    let json: { data?: { status?: string } }
    try {
      json = (await res.json()) as { data?: { status?: string } }
    } catch {
      return { ok: false, message: "Could not verify this email. Please try again." }
    }

    const status = json.data?.status

    if (!status) {
      return { ok: false, message: "Could not verify this email. Please try again." }
    }

    if (ACCEPTABLE_STATUSES.has(status)) {
      return { ok: true }
    }

    if (status === "invalid") {
      return {
        ok: false,
        message:
          "This email address does not appear to be valid or deliverable. Please check it and try again.",
      }
    }

    if (status === "disposable") {
      return {
        ok: false,
        message:
          "Temporary or disposable email addresses are not accepted. Please use a permanent email.",
      }
    }

    if (status === "unknown") {
      return {
        ok: false,
        message:
          "We could not verify this email. Please check the address or try another email.",
      }
    }

    return {
      ok: false,
      message: "This email address could not be accepted. Please try a different one.",
    }
  }

  return {
    ok: false,
    message: "Email verification timed out. Please try again.",
  }
}
