import { readFileSync } from "node:fs"
import { resolve, dirname } from "node:path"
import { fileURLToPath } from "node:url"
import { Redis } from "ioredis"

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../../..")

function loadRedisUrl() {
  for (const rel of [
    "apps/dashboard/.env.development",
    "apps/api/.env.local",
    ".env.local",
  ]) {
    const path = resolve(root, rel)
    try {
      const env = readFileSync(path, "utf8")
      const match = env.match(/REDIS_URL=(?:"([^"]+)"|'([^']+)'|(\S+))/)
      if (match) return match[1] ?? match[2] ?? match[3]
    } catch {
      // try next
    }
  }
  throw new Error("REDIS_URL not found")
}

const redis = new Redis(loadRedisUrl(), {
  maxRetriesPerRequest: 1,
  connectTimeout: 15_000,
})

const items = await redis.lrange("failed_events", 0, -1)
console.log(`failed_events count: ${items.length}`)

for (let i = 0; i < items.length; i++) {
  console.log(`\n--- entry ${i} ---`)
  try {
    const parsed = JSON.parse(items[i])
    const summary = {
      reason:
        parsed.reason ??
        (parsed.error ? "clickhouse_insert_failed" : "unknown"),
      error: parsed.error,
      timestamp: parsed.timestamp,
    }
    if (parsed.payload) {
      summary.payload_preview =
        typeof parsed.payload === "string"
          ? parsed.payload.slice(0, 300)
          : parsed.payload
    }
    if (Array.isArray(parsed.events)) {
      summary.batch_size = parsed.events.length
      summary.first_event = parsed.events[0]
    }
    console.log(JSON.stringify(summary, null, 2))
  } catch {
    console.log(items[i].slice(0, 500))
  }
}

await redis.quit()
