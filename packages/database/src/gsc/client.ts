export type GscSearchAnalyticsRow = {
  query: string
  pageUrl: string
  reportDate: string
  clicks: number
  impressions: number
  ctr: number
  position: number
}

export type GscSiteEntry = {
  siteUrl: string
  permissionLevel: string
}

function requireGoogleOAuthClient(): { clientId: string; clientSecret: string } {
  const clientId = process.env.GOOGLE_CLIENT_ID?.trim()
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET?.trim()
  if (!clientId || !clientSecret) {
    throw new Error("GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET are required for GSC")
  }
  return { clientId, clientSecret }
}

export async function refreshGscAccessToken(
  refreshToken: string
): Promise<string> {
  const { clientId, clientSecret } = requireGoogleOAuthClient()
  const body = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    refresh_token: refreshToken,
    grant_type: "refresh_token",
  })
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body,
  })
  if (!res.ok) {
    const text = await res.text().catch(() => "")
    throw new Error(`GSC token refresh failed (${res.status}): ${text.slice(0, 200)}`)
  }
  const json = (await res.json()) as { access_token?: string }
  if (!json.access_token) {
    throw new Error("GSC token refresh returned no access_token")
  }
  return json.access_token
}

export async function exchangeGscAuthCode(
  code: string,
  redirectUri: string
): Promise<{ refreshToken: string; accessToken: string; email?: string }> {
  const { clientId, clientSecret } = requireGoogleOAuthClient()
  const body = new URLSearchParams({
    code,
    client_id: clientId,
    client_secret: clientSecret,
    redirect_uri: redirectUri,
    grant_type: "authorization_code",
  })
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body,
  })
  if (!res.ok) {
    const text = await res.text().catch(() => "")
    throw new Error(`GSC code exchange failed (${res.status}): ${text.slice(0, 200)}`)
  }
  const json = (await res.json()) as {
    access_token?: string
    refresh_token?: string
  }
  if (!json.access_token) {
    throw new Error("GSC code exchange returned no access_token")
  }
  if (!json.refresh_token) {
    throw new Error(
      "GSC did not return a refresh_token. Reconnect with prompt=consent."
    )
  }

  let email: string | undefined
  try {
    const profileRes = await fetch(
      "https://openidconnect.googleapis.com/v1/userinfo",
      { headers: { Authorization: `Bearer ${json.access_token}` } }
    )
    if (profileRes.ok) {
      const profile = (await profileRes.json()) as { email?: string }
      email = profile.email?.trim() || undefined
    }
  } catch {
    // email is optional metadata
  }

  return {
    refreshToken: json.refresh_token,
    accessToken: json.access_token,
    email,
  }
}

export function buildGscAuthorizeUrl(params: {
  redirectUri: string
  state: string
}): string {
  const { clientId } = requireGoogleOAuthClient()
  const url = new URL("https://accounts.google.com/o/oauth2/v2/auth")
  url.searchParams.set("client_id", clientId)
  url.searchParams.set("redirect_uri", params.redirectUri)
  url.searchParams.set("response_type", "code")
  url.searchParams.set(
    "scope",
    "openid email https://www.googleapis.com/auth/webmasters.readonly"
  )
  url.searchParams.set("access_type", "offline")
  url.searchParams.set("prompt", "consent")
  url.searchParams.set("state", params.state)
  return url.toString()
}

export async function listGscSites(accessToken: string): Promise<GscSiteEntry[]> {
  const res = await fetch("https://www.googleapis.com/webmasters/v3/sites", {
    headers: { Authorization: `Bearer ${accessToken}` },
  })
  if (!res.ok) {
    const text = await res.text().catch(() => "")
    throw new Error(`GSC sites.list failed (${res.status}): ${text.slice(0, 200)}`)
  }
  const json = (await res.json()) as {
    siteEntry?: Array<{ siteUrl?: string; permissionLevel?: string }>
  }
  return (json.siteEntry ?? [])
    .map((entry) => ({
      siteUrl: String(entry.siteUrl ?? "").trim(),
      permissionLevel: String(entry.permissionLevel ?? ""),
    }))
    .filter((entry) => entry.siteUrl.length > 0)
}

function toDateKey(d: Date): string {
  const y = d.getUTCFullYear()
  const m = String(d.getUTCMonth() + 1).padStart(2, "0")
  const day = String(d.getUTCDate()).padStart(2, "0")
  return `${y}-${m}-${day}`
}

export async function fetchGscSearchAnalytics(params: {
  accessToken: string
  siteUrl: string
  startDate: Date
  endDate: Date
  pageFilter?: string
}): Promise<GscSearchAnalyticsRow[]> {
  const startKey = toDateKey(params.startDate)
  const endExclusive = params.endDate
  const endInclusive = new Date(endExclusive.getTime() - 24 * 60 * 60 * 1000)
  const endKey = toDateKey(
    endInclusive.getTime() < params.startDate.getTime()
      ? params.startDate
      : endInclusive
  )

  const encodedSite = encodeURIComponent(params.siteUrl)
  const endpoint = `https://www.googleapis.com/webmasters/v3/sites/${encodedSite}/searchAnalytics/query`

  const rows: GscSearchAnalyticsRow[] = []
  let startRow = 0
  const rowLimit = 25000

  for (;;) {
    const body: Record<string, unknown> = {
      startDate: startKey,
      endDate: endKey,
      dimensions: ["query", "page", "date"],
      rowLimit,
      startRow,
      dataState: "final",
    }
    if (params.pageFilter?.trim()) {
      body.dimensionFilterGroups = [
        {
          filters: [
            {
              dimension: "page",
              operator: "contains",
              expression: params.pageFilter.trim(),
            },
          ],
        },
      ]
    }

    const res = await fetch(endpoint, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${params.accessToken}`,
        "content-type": "application/json",
      },
      body: JSON.stringify(body),
    })
    if (!res.ok) {
      const text = await res.text().catch(() => "")
      throw new Error(
        `GSC searchAnalytics.query failed (${res.status}): ${text.slice(0, 300)}`
      )
    }
    const json = (await res.json()) as {
      rows?: Array<{
        keys?: string[]
        clicks?: number
        impressions?: number
        ctr?: number
        position?: number
      }>
    }
    const batch = json.rows ?? []
    for (const row of batch) {
      const keys = row.keys ?? []
      const query = String(keys[0] ?? "").trim() || "(not provided)"
      const pageUrl = String(keys[1] ?? "").trim()
      const reportDate = String(keys[2] ?? "").trim()
      if (!pageUrl || !reportDate) continue
      rows.push({
        query: query.slice(0, 500),
        pageUrl: pageUrl.slice(0, 2048),
        reportDate,
        clicks: Math.max(0, Math.floor(Number(row.clicks) || 0)),
        impressions: Math.max(0, Math.floor(Number(row.impressions) || 0)),
        ctr: Math.max(0, Number(row.ctr) || 0) * 100,
        position: Math.max(0, Number(row.position) || 0),
      })
    }
    if (batch.length < rowLimit) break
    startRow += rowLimit
    if (startRow > 100_000) break
  }

  return rows
}

export function gscPageFilterFromLanding(lp: {
  normalizedUrl: string
  origin: string
  hostname: string
}): string {
  try {
    const u = new URL(lp.normalizedUrl)
    if (u.pathname && u.pathname !== "/") {
      return `${u.origin}${u.pathname}`
    }
    return u.origin
  } catch {
    return lp.origin || lp.hostname
  }
}
