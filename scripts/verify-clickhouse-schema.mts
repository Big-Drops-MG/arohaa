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
  const meta = await client.query({
    query:
      "SELECT name, partition_key, sorting_key, primary_key FROM system.tables WHERE database = currentDatabase() AND name = 'events'",
    format: "JSON",
  })
  console.log("=== TABLE META ===")
  console.log(await meta.text())

  const cols = await client.query({
    query:
      "SELECT name, type FROM system.columns WHERE database = currentDatabase() AND table = 'events' ORDER BY position",
    format: "JSON",
  })
  console.log("=== COLUMNS ===")
  console.log(await cols.text())

  const parts = await client.query({
    query:
      "SELECT partition, name, rows FROM system.parts WHERE database = currentDatabase() AND table = 'events' AND active",
    format: "JSON",
  })
  console.log("=== ACTIVE PARTS ===")
  console.log(await parts.text())
} catch (err) {
  console.error("Verify failed:", err)
  process.exitCode = 1
} finally {
  await client.close()
}
