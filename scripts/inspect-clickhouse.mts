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
  const rows = await client.query({
    query: "SELECT count() AS n FROM events",
    format: "JSON",
  })
  console.log("=== ROW COUNT ===")
  console.log(await rows.text())

  const recent = await client.query({
    query: `
      SELECT
        created_at,
        event_name,
        workspace_id,
        substring(user_id, 1, 8) AS uid_short,
        substring(session_id, 1, 8) AS sid_short,
        url,
        properties
      FROM events
      ORDER BY created_at DESC
      LIMIT 20
    `,
    format: "JSON",
  })
  console.log("=== RECENT EVENTS ===")
  console.log(await recent.text())

  const summary = await client.query({
    query: `
      SELECT event_name, count() AS n, max(created_at) AS most_recent
      FROM events
      GROUP BY event_name
      ORDER BY n DESC
    `,
    format: "JSON",
  })
  console.log("=== EVENT NAME SUMMARY ===")
  console.log(await summary.text())
} catch (err) {
  console.error("Inspection failed:", err)
  process.exitCode = 1
} finally {
  await client.close()
}
