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

const before = await redis.llen("failed_events")
await redis.del("failed_events")
const after = await redis.llen("failed_events")
console.log(`failed_events cleared: ${before} -> ${after}`)
await redis.quit()
