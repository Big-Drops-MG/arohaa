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
  const events = await client.query({
    query: `
      SELECT
        formatDateTime(created_at, '%H:%i:%S.%f') AS at,
        event_name,
        utm_source,
        utm_medium,
        utm_campaign,
        utm_term,
        utm_content,
        referrer
      FROM events
      ORDER BY created_at ASC
    `,
    format: "JSON",
  })
  console.log("=== ALL EVENTS WITH ATTRIBUTION ===")
  console.log(await events.text())

  const roi = await client.query({
    query: `
      SELECT
        utm_source,
        utm_medium,
        utm_campaign,
        countIf(event_name = 'page_view') AS landings,
        countIf(event_name = 'checkout_started') AS checkouts,
        count() AS total_events
      FROM events
      WHERE utm_source != ''
      GROUP BY utm_source, utm_medium, utm_campaign
      ORDER BY total_events DESC
    `,
    format: "JSON",
  })
  console.log("=== MARKETING ROI ROLLUP ===")
  console.log(await roi.text())
} catch (err) {
  console.error("Verify failed:", err)
  process.exitCode = 1
} finally {
  await client.close()
}
