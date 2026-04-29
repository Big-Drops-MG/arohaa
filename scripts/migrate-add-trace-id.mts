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

const TRACE_ID_COLUMN: ColumnSpec = {
  name: "trace_id",
  type: "String DEFAULT ''",
  after: "properties",
}

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
  const cols = await existingColumns()
  if (cols.has(TRACE_ID_COLUMN.name)) {
    console.log(`column ${TRACE_ID_COLUMN.name} already exists, skipping`)
  } else {
    console.log(
      `adding column ${TRACE_ID_COLUMN.name} ${TRACE_ID_COLUMN.type} AFTER ${TRACE_ID_COLUMN.after}`,
    )
    await client.command({
      query: `ALTER TABLE events ADD COLUMN IF NOT EXISTS ${TRACE_ID_COLUMN.name} ${TRACE_ID_COLUMN.type} AFTER ${TRACE_ID_COLUMN.after}`,
    })
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
