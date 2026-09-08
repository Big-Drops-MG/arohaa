import { eq } from "drizzle-orm"
import { db, users } from "@workspace/database"

type GoogleProfileLike = {
  picture?: unknown
  image?: unknown
}

function asTrimmedUrl(value: unknown): string | null {
  if (typeof value !== "string") return null
  const trimmed = value.trim()
  if (!trimmed) return null
  if (!/^https?:\/\//i.test(trimmed)) return null
  return trimmed
}

/**
 * Resolve the Google account photo from OAuth profile / userinfo.
 * Auth.js `user.image` is often the stale DB row on repeat sign-ins; prefer `profile.picture`.
 */
export async function resolveGoogleProfileImage(input: {
  profile?: GoogleProfileLike | null
  userImage?: string | null
  accessToken?: string | null
}): Promise<string | null> {
  const fromProfile =
    asTrimmedUrl(input.profile?.picture) ?? asTrimmedUrl(input.profile?.image)
  if (fromProfile) return fromProfile

  const fromUser = asTrimmedUrl(input.userImage)
  if (fromUser) return fromUser

  if (!input.accessToken) return null

  try {
    const res = await fetch(
      "https://openidconnect.googleapis.com/v1/userinfo",
      {
        headers: { Authorization: `Bearer ${input.accessToken}` },
        cache: "no-store",
      }
    )
    if (!res.ok) return null
    const data = (await res.json()) as GoogleProfileLike
    return asTrimmedUrl(data.picture) ?? asTrimmedUrl(data.image)
  } catch {
    return null
  }
}

export async function syncGoogleProfileImageForUser(input: {
  userId: string
  profile?: GoogleProfileLike | null
  userImage?: string | null
  accessToken?: string | null
}): Promise<string | null> {
  const imageUrl = await resolveGoogleProfileImage(input)
  if (!imageUrl) return null

  const [current] = await db
    .select({ image: users.image })
    .from(users)
    .where(eq(users.id, input.userId))
    .limit(1)

  if ((current?.image ?? "") === imageUrl) return imageUrl

  await db
    .update(users)
    .set({ image: imageUrl })
    .where(eq(users.id, input.userId))

  return imageUrl
}
