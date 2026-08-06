import { neon } from '@neondatabase/serverless'

let sqlSingleton: ReturnType<typeof neon> | null = null

function getSql(): ReturnType<typeof neon> | null {
  if (sqlSingleton) return sqlSingleton
  const url =
    process.env.DATABASE_URL ??
    process.env.POSTGRES_PRISMA_URL ??
    process.env.POSTGRES_URL
  if (!url) return null
  sqlSingleton = neon(url)
  return sqlSingleton
}

export async function landingPageHasRedirect(
  landingPageId: string,
): Promise<boolean> {
  const sql = getSql()
  if (!sql) return false
  try {
    const rows = (await sql`
      SELECT lp."redirectPageUrl" AS url
      FROM landing_page lp
      WHERE lp.id = ${landingPageId}
        AND lp."deletedAt" IS NULL
      LIMIT 1
    `) as Array<{ url: string | null }>
    return Boolean(rows[0]?.url?.trim())
  } catch {
    return false
  }
}
