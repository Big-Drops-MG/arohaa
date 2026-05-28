import { createClient } from "@clickhouse/client"
import { config } from "dotenv"
import path from "node:path"

config({ path: path.resolve("apps/dashboard/.env.local") })

const client = createClient({
  url: process.env.CLICKHOUSE_URL,
  username: process.env.CLICKHOUSE_USER ?? "default",
  password: process.env.CLICKHOUSE_PASSWORD,
})

try {
  const cols = await client.query({
    query:
      "SELECT name FROM system.columns WHERE database = currentDatabase() AND table = 'events' AND name = 'fingerprint'",
    format: "JSON",
  })
  const json = (await cols.json()) as { data: Array<{ name: string }> }
  if (json.data.length > 0) {
    console.log("fingerprint column already exists. Nothing to do.")
  } else {
    console.log("Adding fingerprint column...")
    await client.command({
      query:
        "ALTER TABLE events ADD COLUMN IF NOT EXISTS fingerprint String DEFAULT '' AFTER session_id",
    })
    console.log("fingerprint column added.")
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
