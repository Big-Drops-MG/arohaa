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
  const summary = await client.query({
    query: `
      SELECT
        event_name,
        metric_name,
        count() AS n,
        round(avg(metric_value), 3) AS avg_value,
        round(min(metric_value), 3) AS min_value,
        round(max(metric_value), 3) AS max_value
      FROM events
      GROUP BY event_name, metric_name
      ORDER BY event_name, metric_name
    `,
    format: "JSON",
  })
  console.log("=== EVENT + METRIC SUMMARY ===")
  console.log(await summary.text())

  const vitals = await client.query({
    query: `
      SELECT
        formatDateTime(created_at, '%H:%i:%S.%f') AS at,
        event_name,
        metric_name,
        metric_value,
        utm_source,
        utm_campaign
      FROM events
      WHERE event_name IN ('web_vitals', 'heartbeat')
      ORDER BY created_at ASC
    `,
    format: "JSON",
  })
  console.log("=== VITALS + HEARTBEAT EVENTS ===")
  console.log(await vitals.text())

  const fullChrono = await client.query({
    query: `
      SELECT
        formatDateTime(created_at, '%H:%i:%S.%f') AS at,
        event_name,
        metric_name,
        metric_value
      FROM events
      ORDER BY created_at ASC
    `,
    format: "JSON",
  })
  console.log("=== FULL EVENT TIMELINE ===")
  console.log(await fullChrono.text())
} catch (err) {
  console.error("Verify failed:", err)
  process.exitCode = 1
} finally {
  await client.close()
}
