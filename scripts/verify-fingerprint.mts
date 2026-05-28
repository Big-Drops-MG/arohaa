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
  const distinct = await client.query({
    query: `
      SELECT
        countDistinct(user_id) AS distinct_uids,
        countDistinct(session_id) AS distinct_sids,
        countDistinct(fingerprint) AS distinct_fps,
        count() AS total_rows
      FROM events
    `,
    format: "JSON",
  })
  console.log("=== DISTINCT IDENTITY VALUES ===")
  console.log(await distinct.text())

  const sample = await client.query({
    query: `
      SELECT
        substring(user_id, 1, 8) AS uid_short,
        substring(session_id, 1, 8) AS sid_short,
        fingerprint,
        count() AS events
      FROM events
      GROUP BY user_id, session_id, fingerprint
      ORDER BY events DESC
    `,
    format: "JSON",
  })
  console.log("=== IDENTITY GROUPS ===")
  console.log(await sample.text())

  const recent = await client.query({
    query: `
      SELECT
        formatDateTime(created_at, '%H:%i:%S.%f') AS at,
        event_name,
        substring(user_id, 1, 8) AS uid_short,
        substring(session_id, 1, 8) AS sid_short,
        fingerprint AS fp,
        properties
      FROM events
      ORDER BY created_at ASC
    `,
    format: "JSON",
  })
  console.log("=== ALL EVENTS (CHRONOLOGICAL) ===")
  console.log(await recent.text())
} catch (err) {
  console.error("Verify failed:", err)
  process.exitCode = 1
} finally {
  await client.close()
}
