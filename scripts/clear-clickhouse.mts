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
  await client.command({ query: "TRUNCATE TABLE events" })
  console.log("events table truncated.")
} catch (err) {
  console.error("Truncate failed:", err)
  process.exitCode = 1
} finally {
  await client.close()
}
