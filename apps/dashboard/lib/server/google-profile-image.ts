import { createHash } from "node:crypto"
import { eq } from "drizzle-orm"
import { db, users } from "@workspace/database"

type GoogleProfileLike = {
  picture?: unknown
  image?: unknown
}

/** Google's anonymous silhouette PNG returned for expired/non-public photo URLs. */
export const GOOGLE_DEFAULT_AVATAR_SHA256 =
  "653f73dde99fede7a5ebaed7a14dad72c299935d3b9a0bad7420769cc8186a32"

type PeoplePhotosResponse = {
  photos?: Array<{
    url?: string
    default?: boolean
  }>
}

function asTrimmedUrl(value: unknown): string | null {
  if (typeof value !== "string") return null
  const trimmed = value.trim()
  if (!trimmed) return null
  if (!/^https?:\/\//i.test(trimmed)) return null
  return trimmed
}

export function normalizeGooglePhotoUrl(url: string): string {
  const trimmed = url.trim()
  try {
    const parsed = new URL(trimmed)
    if (!parsed.hostname.endsWith("googleusercontent.com")) return trimmed
    // Drop prior size directives so we request a stable public thumbnail.
    parsed.pathname = parsed.pathname.replace(/=s\d+-?[cw]?$/i, "")
    parsed.search = ""
    parsed.hash = ""
    return `${parsed.toString()}=s128-c`
  } catch {
    return trimmed
  }
}

async function sha256Hex(bytes: ArrayBuffer): Promise<string> {
  return createHash("sha256").update(Buffer.from(bytes)).digest("hex")
}

export async function isUnusableGoogleAvatarUrl(url: string): Promise<boolean> {
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": "Mozilla/5.0" },
      cache: "no-store",
      redirect: "follow",
      signal: AbortSignal.timeout(8_000),
    })
    if (!res.ok) return true
    const contentType = res.headers.get("content-type") ?? ""
    if (!contentType.startsWith("image/")) return true
    const bytes = await res.arrayBuffer()
    if (bytes.byteLength < 32) return true
    const hash = await sha256Hex(bytes)
    return hash === GOOGLE_DEFAULT_AVATAR_SHA256
  } catch {
    return true
  }
}

async function fetchPeoplePhotoUrl(
  accessToken: string
): Promise<string | null> {
  try {
    const res = await fetch(
      "https://people.googleapis.com/v1/people/me?personFields=photos",
      {
        headers: { Authorization: `Bearer ${accessToken}` },
        cache: "no-store",
        signal: AbortSignal.timeout(8_000),
      }
    )
    if (!res.ok) return null
    const data = (await res.json()) as PeoplePhotosResponse
    const photos = data.photos ?? []
    const preferred =
      photos.find((photo) => photo.url && photo.default === false) ??
      photos.find((photo) => photo.url && photo.default !== true) ??
      null
    return asTrimmedUrl(preferred?.url ?? null)
  } catch {
    return null
  }
}

async function fetchUserInfoPhotoUrl(
  accessToken: string,
  endpoint: string
): Promise<string | null> {
  try {
    const res = await fetch(endpoint, {
      headers: { Authorization: `Bearer ${accessToken}` },
      cache: "no-store",
      signal: AbortSignal.timeout(8_000),
    })
    if (!res.ok) return null
    const data = (await res.json()) as GoogleProfileLike
    return asTrimmedUrl(data.picture) ?? asTrimmedUrl(data.image)
  } catch {
    return null
  }
}

async function firstUsablePhotoUrl(
  candidates: Array<string | null | undefined>
): Promise<string | null> {
  const seen = new Set<string>()
  for (const candidate of candidates) {
    const raw = asTrimmedUrl(candidate)
    if (!raw) continue
    const normalized = normalizeGooglePhotoUrl(raw)
    if (seen.has(normalized)) continue
    seen.add(normalized)
    if (await isUnusableGoogleAvatarUrl(normalized)) continue
    return normalized
  }
  return null
}

/**
 * Resolve the Google account photo from OAuth profile / People API / userinfo.
 * Auth.js `user.image` is often the stale DB row on repeat sign-ins; prefer live
 * Google photo endpoints and reject the default silhouette placeholder.
 */
export async function resolveGoogleProfileImage(input: {
  profile?: GoogleProfileLike | null
  userImage?: string | null
  accessToken?: string | null
}): Promise<string | null> {
  const fromProfile =
    asTrimmedUrl(input.profile?.picture) ?? asTrimmedUrl(input.profile?.image)

  const remote: Array<string | null> = []
  if (input.accessToken) {
    remote.push(await fetchPeoplePhotoUrl(input.accessToken))
    remote.push(
      await fetchUserInfoPhotoUrl(
        input.accessToken,
        "https://openidconnect.googleapis.com/v1/userinfo"
      )
    )
    remote.push(
      await fetchUserInfoPhotoUrl(
        input.accessToken,
        "https://www.googleapis.com/oauth2/v2/userinfo"
      )
    )
  }

  return firstUsablePhotoUrl([
    ...remote,
    fromProfile,
    asTrimmedUrl(input.userImage),
  ])
}

export async function syncGoogleProfileImageForUser(input: {
  userId: string
  profile?: GoogleProfileLike | null
  userImage?: string | null
  accessToken?: string | null
}): Promise<string | null> {
  const imageUrl = await resolveGoogleProfileImage(input)

  const [current] = await db
    .select({ image: users.image })
    .from(users)
    .where(eq(users.id, input.userId))
    .limit(1)

  if (!imageUrl) {
    // Clear unusable / default silhouette URLs so the UI shows initials instead
    // of identical placeholder faces for every teammate.
    if (current?.image) {
      await db
        .update(users)
        .set({ image: null })
        .where(eq(users.id, input.userId))
    }
    return null
  }

  if ((current?.image ?? "") === imageUrl) return imageUrl

  await db
    .update(users)
    .set({ image: imageUrl })
    .where(eq(users.id, input.userId))

  return imageUrl
}
