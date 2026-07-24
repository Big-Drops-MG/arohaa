import { readdirSync, readFileSync } from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"
import pg from "pg"
import { config } from "dotenv"

const root = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../..",
)
config({ path: path.resolve(root, ".env") })
config({ path: path.resolve(root, "apps/dashboard/.env.local") })
config({ path: path.resolve(root, "apps/dashboard/.env.development") })
config({ path: path.resolve(root, "apps/api/.env") })
config({ path: path.resolve(root, "apps/api/.env.local") })

const databaseUrl = process.env.DATABASE_URL?.trim()
if (!databaseUrl) {
  console.error("DATABASE_URL is required")
  process.exit(1)
}

async function main() {
  const drizzleDir = path.resolve(
    path.dirname(fileURLToPath(import.meta.url)),
    "../drizzle",
  )
  const files = readdirSync(drizzleDir)
    .filter((name) => name.endsWith(".sql"))
    .sort()

  const client = new pg.Client({
    connectionString: databaseUrl,
    ssl: { rejectUnauthorized: false },
  })
  await client.connect()

  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        id text PRIMARY KEY,
        applied_at timestamptz NOT NULL DEFAULT now()
      )
    `)

    const applied = await client.query(`SELECT id FROM schema_migrations`)
    const appliedSet = new Set(
      applied.rows.map((row) => row.id as string),
    )

    if (appliedSet.size === 0) {
      const legacy = await client.query(
        `SELECT to_regclass('public."user"') AS user_table`,
      )
      if (legacy.rows[0]?.user_table) {
        console.log("Existing database detected — marking prior migrations as applied")
        for (const file of files) {
          if (file === "0011_seo_results.sql") continue
          await client.query(`INSERT INTO schema_migrations (id) VALUES ($1)`, [
            file,
          ])
          appliedSet.add(file)
        }
      }
    }

    for (const file of files) {
      if (appliedSet.has(file)) {
        console.log(`skip ${file}`)
        continue
      }
      const body = readFileSync(path.join(drizzleDir, file), "utf8")
      console.log(`apply ${file}`)
      await client.query(body)
      await client.query(`INSERT INTO schema_migrations (id) VALUES ($1)`, [
        file,
      ])
    }

    console.log("Migrations complete.")
  } finally {
    await client.end()
  }
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
