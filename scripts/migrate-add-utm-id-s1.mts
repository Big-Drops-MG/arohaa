import { createClient } from "@clickhouse/client"
import { config } from "dotenv"
import path from "node:path"

config({ path: path.resolve("apps/dashboard/.env.local") })

const client = createClient({
  url: process.env.CLICKHOUSE_URL,
  username: process.env.CLICKHOUSE_USER ?? "default",
  password: process.env.CLICKHOUSE_PASSWORD,
})

interface ColumnSpec {
  name: string
  type: string
  after: string
}

const COLUMNS: ColumnSpec[] = [
  { name: "utm_id", type: "LowCardinality(String) DEFAULT ''", after: "utm_content" },
  { name: "utm_s1", type: "LowCardinality(String) DEFAULT ''", after: "utm_id" },
]

async function existingColumns(): Promise<Set<string>> {
  const r = await client.query({
    query:
      "SELECT name FROM system.columns WHERE database = currentDatabase() AND table = 'events'",
    format: "JSON",
  })
  const json = (await r.json()) as { data: Array<{ name: string }> }
  return new Set(json.data.map((row) => row.name))
}

try {
  let cols = await existingColumns()
  for (const col of COLUMNS) {
    if (cols.has(col.name)) {
      console.log(`column ${col.name} already exists, skipping`)
      continue
    }
    console.log(`adding column ${col.name} ${col.type} AFTER ${col.after}`)
    await client.command({
      query: `ALTER TABLE events ADD COLUMN IF NOT EXISTS ${col.name} ${col.type} AFTER ${col.after}`,
    })
    cols = await existingColumns()
  }

  const verify = await client.query({
    query:
      "SELECT name, type FROM system.columns WHERE database = currentDatabase() AND table = 'events' ORDER BY position",
    format: "JSON",
  })
  console.log("=== COLUMNS AFTER MIGRATION ===")
  console.log(await verify.text())
} catch (err) {
  console.error("Migration failed:", err)
  process.exitCode = 1
} finally {
  await client.close()
}
