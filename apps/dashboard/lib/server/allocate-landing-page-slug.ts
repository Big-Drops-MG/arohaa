import { and, eq, ne } from "drizzle-orm"
import { db, landingPageSlugCandidate, landingPages } from "@workspace/database"

export async function allocateLandingPageSlug(
  name: string,
  publicId: string,
  opts?: { excludeLandingPageId?: string }
): Promise<string> {
  for (let sequence = 1; sequence <= 1_000; sequence += 1) {
    const candidate = landingPageSlugCandidate(name, sequence, publicId)
    const [existing] = await db
      .select({ id: landingPages.id })
      .from(landingPages)
      .where(
        and(
          eq(landingPages.slug, candidate),
          opts?.excludeLandingPageId
            ? ne(landingPages.id, opts.excludeLandingPageId)
            : undefined
        )
      )
      .limit(1)
    if (!existing) return candidate
  }
  throw new Error("Could not allocate a unique landing page slug")
}

/** True when the slug is still a valid allocation for this brand name. */
export function slugMatchesBrandName(
  slug: string,
  brandName: string,
  publicId: string
): boolean {
  for (let sequence = 1; sequence <= 1_000; sequence += 1) {
    if (landingPageSlugCandidate(brandName, sequence, publicId) === slug) {
      return true
    }
  }
  return false
}
