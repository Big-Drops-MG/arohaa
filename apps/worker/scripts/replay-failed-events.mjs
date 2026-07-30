/**
 * Replays entries from the `failed_events` dead-letter queue back onto the
 * queues the worker consumes.
 *
 * Entries come in two shapes:
 *   - single rejected event:  { reason, payload: "<json>", timestamp, type? }
 *   - failed insert batch:    { events: [...], error, timestamp, type? }
 * `type: "heatmap"` routes to `heatmap_queue`, otherwise `analytics_queue`.
 *
 * A batch is dead-lettered when the ClickHouse insert *reports* failure, but a
 * client-side timeout can still have committed server-side. Both target tables
 * are plain MergeTree with no deduplication, so every event is checked against
 * ClickHouse first and skipped if it is already there.
 *
 * Runs as a dry run unless `--apply` is passed. In apply mode entries are
 * drained oldest-first with RPOP and re-queued with RPUSH so replayed events
 * sit behind live traffic. Events that still fail validation are moved to
 * `failed_events_unreplayable` rather than dropped.
 *
 * Requires REDIS_URL, CLICKHOUSE_URL, CLICKHOUSE_USER, CLICKHOUSE_PASSWORD.
 *
 * Usage:
 *   node scripts/replay-failed-events.mjs
 *   node scripts/replay-failed-events.mjs --apply
 */
import { readFileSync } from "node:fs"
import { resolve, dirname } from "node:path"
import { fileURLToPath } from "node:url"
import { Redis } from "ioredis"
import {
  validateEvent,
  validateHeatmapEvent,
} from "../src/processor/validator.js"

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../../..")

const DLQ_KEY = "failed_events"
const UNREPLAYABLE_KEY = "failed_events_unreplayable"
const HEATMAP_QUEUE = "heatmap_queue"
const ANALYTICS_QUEUE = "analytics_queue"
const DUP_CHECK_CHUNK = 200

const apply = process.argv.includes("--apply")

function loadFromEnvFiles(key) {
  for (const rel of [
    "apps/dashboard/.env.development",
    "apps/api/.env.local",
    ".env.local",
  ]) {
    try {
      const env = readFileSync(resolve(root, rel), "utf8")
      const match = env.match(
        new RegExp(`${key}=(?:"([^"]+)"|'([^']+)'|(\\S+))`)
      )
      if (match) return match[1] ?? match[2] ?? match[3]
    } catch {
      // try next
    }
  }
  return undefined
}

function requireConfig(key) {
  const value = process.env[key]?.trim() || loadFromEnvFiles(key)
  if (!value) throw new Error(`${key} not found`)
  return value
}

const chUrl = requireConfig("CLICKHOUSE_URL")
const chUser = requireConfig("CLICKHOUSE_USER")
const chPass = requireConfig("CLICKHOUSE_PASSWORD")

async function chQuery(sql) {
  const res = await fetch(`${chUrl}/?query=${encodeURIComponent(sql)}`, {
    headers: { "X-ClickHouse-User": chUser, "X-ClickHouse-Key": chPass },
  })
  const text = await res.text()
  if (!res.ok) throw new Error(`ClickHouse ${res.status}: ${text.slice(0, 300)}`)
  return text.trim()
}

function quote(value) {
  return `'${String(value ?? "").replace(/\\/g, "\\\\").replace(/'/g, "\\'")}'`
}

/** Identity used to decide whether an event already landed in ClickHouse. */
function signature(event, isHeatmap) {
  return isHeatmap
    ? [
        event.workspace_id,
        event.page_url,
        event.event_type,
        event.timestamp,
        event.element_selector ?? "",
      ].join("|")
    : [
        event.workspace_id,
        event.session_id,
        event.event_name,
        event.created_at,
      ].join("|")
}

/** Flattens a DLQ entry into the individual events it was holding. */
function extractEvents(entry) {
  const isHeatmap = entry.type === "heatmap"
  const queue = isHeatmap ? HEATMAP_QUEUE : ANALYTICS_QUEUE

  if (Array.isArray(entry.events)) {
    return entry.events.map((event) => ({ event, queue, isHeatmap }))
  }
  if (typeof entry.payload === "string") {
    return [{ event: JSON.parse(entry.payload), queue, isHeatmap }]
  }
  return []
}

async function findExisting(events, isHeatmap) {
  const found = new Set()
  if (events.length === 0) return found

  const table = isHeatmap ? "heatmap_events" : "events_raw"
  const cols = isHeatmap
    ? [
        "toString(workspace_id)",
        "page_url",
        "event_type",
        "toString(timestamp)",
        "element_selector",
      ]
    : [
        "toString(workspace_id)",
        "session_id",
        "event_name",
        "toString(created_at)",
      ]
  const values = (event) =>
    isHeatmap
      ? [
          event.workspace_id,
          event.page_url,
          event.event_type,
          event.timestamp,
          event.element_selector ?? "",
        ]
      : [
          event.workspace_id,
          event.session_id,
          event.event_name,
          event.created_at,
        ]

  for (let i = 0; i < events.length; i += DUP_CHECK_CHUNK) {
    const chunk = events.slice(i, i + DUP_CHECK_CHUNK)
    const tuples = chunk
      .map((e) => `(${values(e).map(quote).join(",")})`)
      .join(",")
    const sql =
      `SELECT DISTINCT ${cols.join(",")} FROM ${table} ` +
      `WHERE (${cols.join(",")}) IN (${tuples}) FORMAT TSV`
    const rows = await chQuery(sql)
    if (!rows) continue
    for (const line of rows.split("\n")) {
      found.add(line.split("\t").join("|"))
    }
  }
  return found
}

const redis = new Redis(requireConfig("REDIS_URL"), {
  maxRetriesPerRequest: 1,
  connectTimeout: 15_000,
})

const total = await redis.llen(DLQ_KEY)
console.log(`${DLQ_KEY} depth: ${total}`)
console.log(apply ? "mode: APPLY\n" : "mode: DRY RUN (pass --apply to run)\n")

// Read non-destructively first so the ClickHouse dedup check can run before
// anything is removed from the queue.
const entries = await redis.lrange(DLQ_KEY, 0, -1)
const byReason = {}
const analytics = []
const heatmap = []
let unparseable = 0

for (const raw of entries) {
  let entry
  try {
    entry = JSON.parse(raw)
  } catch {
    unparseable++
    continue
  }
  const reason = entry.reason ?? (entry.error ? "batch_error" : "unknown")
  byReason[reason] = (byReason[reason] ?? 0) + 1
  try {
    for (const item of extractEvents(entry)) {
      ;(item.isHeatmap ? heatmap : analytics).push(item.event)
    }
  } catch {
    unparseable++
  }
}

console.log("checking ClickHouse for events that already landed...")
const existingAnalytics = await findExisting(analytics, false)
const existingHeatmap = await findExisting(heatmap, true)
const duplicates = new Set([...existingAnalytics, ...existingHeatmap])

const stats = {
  entries: 0,
  replayed: 0,
  duplicates: 0,
  invalid: 0,
  unparseable,
  byQueue: {},
}

for (let i = 0; i < total; i++) {
  // Producers LPUSH, so RPOP drains oldest-first.
  const raw = apply ? await redis.rpop(DLQ_KEY) : entries[total - 1 - i]
  if (raw == null) break
  stats.entries++

  let items
  try {
    items = extractEvents(JSON.parse(raw))
  } catch {
    if (apply) await redis.rpush(UNREPLAYABLE_KEY, raw)
    continue
  }

  for (const { event, queue, isHeatmap } of items) {
    if (duplicates.has(signature(event, isHeatmap))) {
      stats.duplicates++
      continue
    }

    const valid = isHeatmap
      ? validateHeatmapEvent({ ...event })
      : validateEvent({ ...event })
    if (!valid) {
      stats.invalid++
      if (apply) {
        await redis.rpush(
          UNREPLAYABLE_KEY,
          JSON.stringify({
            reason: "still_invalid",
            payload: JSON.stringify(event),
          })
        )
      }
      continue
    }

    stats.replayed++
    stats.byQueue[queue] = (stats.byQueue[queue] ?? 0) + 1
    if (apply) await redis.rpush(queue, JSON.stringify(event))
  }
}

console.log("\nentries read:        ", stats.entries)
console.log("events by reason:    ", byReason)
console.log("already in ClickHouse:", stats.duplicates, "(skipped)")
console.log("still invalid:       ", stats.invalid)
console.log("unparseable:         ", stats.unparseable)
console.log("events replayed:     ", stats.replayed)
console.log("target queues:       ", stats.byQueue)

if (apply) {
  console.log(`\n${DLQ_KEY} depth now:`, await redis.llen(DLQ_KEY))
  console.log(`${UNREPLAYABLE_KEY} depth:`, await redis.llen(UNREPLAYABLE_KEY))
  console.log(`${HEATMAP_QUEUE} depth:`, await redis.llen(HEATMAP_QUEUE))
  console.log(`${ANALYTICS_QUEUE} depth:`, await redis.llen(ANALYTICS_QUEUE))
}

await redis.quit()
