import { createClient } from "@clickhouse/client"
import { config } from "dotenv"
import path from "node:path"

config({ path: path.resolve("apps/dashboard/.env.local") })

const client = createClient({
  url: process.env.CLICKHOUSE_URL,
  username: process.env.CLICKHOUSE_USER ?? "default",
  password: process.env.CLICKHOUSE_PASSWORD,
})

const wid = "8ca47040-78ac-4ffd-9804-d91e901a32be"

try {
  const summary = await client.query({
    query: `
      SELECT event_name, count() AS n, max(created_at) AS latest
      FROM events
      WHERE event_name LIKE 'form%'
      GROUP BY event_name
      ORDER BY n DESC
    `,
    format: "JSON",
  })
  console.log("=== ALL form* events ===")
  console.log(await summary.text())

  const recent = await client.query({
    query: `
      SELECT created_at, event_name, workspace_id, url, properties
      FROM events
      WHERE workspace_id = {wid:UUID}
        AND event_name IN ('form_start','form_submit','form_success')
      ORDER BY created_at DESC
      LIMIT 10
    `,
    query_params: { wid },
    format: "JSON",
  })
  console.log("=== Recent form events for workspace ===")
  console.log(await recent.text())
} finally {
  await client.close()
}
