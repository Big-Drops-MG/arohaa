# ClickHouse Changes

Point-by-point summary of ClickHouse-related changes made in this project (Phase 1 + merge resolution + partial-task completion).

---

## 1. Table naming

1. Renamed the raw events table from `events` to **`events_raw`** across the codebase.
2. Added a shared constant `CLICKHOUSE_EVENTS_TABLE = 'events_raw'` in `apps/api/src/lib/clickhouse-events-table.ts`.
3. Worker uses the same table name in `apps/worker/src/processor/dbWriter.js`.

---

## 2. Schema (`events_raw`)

1. Defined the full `events_raw` schema with MergeTree engine.
2. Partition key: `toYYYYMM(created_at)`.
3. Order key: `(workspace_id, toDate(created_at), event_name)`.
4. Columns include: `event_name`, `workspace_id`, `lp_public_id`, `user_id`, `session_id`, `fingerprint`, `url`, UTM fields, `referrer`, `referrer_source`, `browser`, `os`, `device`, `country`, `city`, `variant`, `metric_name`, `metric_value`, `properties`, `trace_id`, `created_at`.
5. Schema is created/verified in:
   - `apps/api/src/services/clickhouse.service.ts` (`ensureEventsTable`)
   - `init-clickhouse.ts` (standalone migration script)

---

## 3. Legacy migration

1. On startup, API runs `migrateLegacyEventsTable()` to rename old `events` table to `events_raw` if needed.
2. `init-clickhouse.ts` does the same rename when `events` exists and `events_raw` does not.
3. If schema mismatch is detected on a non-empty table, migration refuses to drop unless `FORCE_DROP=1`.

---

## 4. Materialized views (query performance)

1. Created **`daily_metrics`** table (AggregatingMergeTree) keyed by `(workspace_id, day)`.
2. Created **`daily_metrics_mv`** materialized view that aggregates from `events_raw`:
   - pageviews
   - visitors
   - sessions
   - interactions
   - form_started
   - form_submitted
3. Overview analytics (`apps/api/src/services/analytics.service.ts`) reads from `daily_metrics` for long-range KPIs instead of scanning all raw rows every time.

---

## 5. Ingestion pipeline (API → Redis → Worker → ClickHouse)

1. **API** does not insert directly into ClickHouse on every request.
2. `apps/api/src/services/event-buffer.ts` batches events and pushes JSON to Redis list **`analytics_queue`** (LPUSH).
3. **Worker** (`apps/worker/src/index.js`) consumes with **BLPOP** from `analytics_queue`.
4. Worker batches up to **1,000 events** or flushes every **5 seconds**.
5. Worker inserts into `events_raw` using **`JSONEachRow`** format via `dbWriter.js`.
6. ClickHouse client uses `async_insert: 1` and `wait_for_async_insert: 1` on API and worker.

---

## 6. Data quality before insert (worker)

1. Expanded validation in `apps/worker/src/processor/validator.js`:
   - Valid UUID `workspace_id` (required)
   - Valid `event_name` pattern
   - Required `user_id` and `session_id`
   - Required valid `created_at` timestamp (range-checked)
2. Invalid events go to Redis DLQ **`failed_events`**, not ClickHouse.
3. PII masking in `apps/worker/src/processor/pii.js`:
   - SHA-256 hash for email-like `user_id`
   - Scans `properties` for email fields and email-shaped values before insert.

---

## 7. Failure handling

1. If ClickHouse insert fails in worker, batch is pushed to **`failed_events`** DLQ in Redis.
2. Sentry captures worker ClickHouse and DLQ errors.
3. API `clickhouse.service.ts` has backoff (`shouldSkipClickHouse`, `noteClickHouseFailure`) for unreachable ClickHouse.
4. API starts even if ClickHouse schema setup fails (logs warning; ingest/analytics may fail until CH is reachable).

---

## 8. Analytics read queries (all workspace-scoped)

All dashboard analytics services query **`events_raw`** with `WHERE workspace_id = ...`:

1. `analytics.service.ts` — overview, landing card metrics (also uses `daily_metrics`)
2. `analytics-traffic.service.ts` — traffic, UTM, time series
3. `analytics-funnel.service.ts` — funnel steps
4. `analytics-events.service.ts` — event counts
5. `analytics-segments.service.ts` — segment breakdowns
6. `analytics-experiments.service.ts` — A/B variant stats
7. `analytics-alerts.service.ts` — alert thresholds

Shared query helpers also use `events_raw` in `packages/database/src/queries/events.ts`.

---

## 9. Redis caching (fewer ClickHouse reads)

1. Added `apps/api/src/lib/analytics-cache.ts` (45s TTL).
2. Cached analytics endpoints: overview, traffic, funnel, events, segments, experiments, alerts, SEO, landing-summary.
3. SEO sync invalidates related SEO cache keys after write.

---

## 10. Health checks

1. `GET /health` — simple `{"status":"ok"}` for uptime monitors.
2. `GET /health/ready` — pings ClickHouse (`SELECT 1`), Redis, and Postgres with timeout.

---

## 11. Verification and test scripts

Updated to use `events_raw`:

1. `run_verification.mjs` — pipeline test, delete/query `events_raw`
2. `verify_pipeline.ts` — end-to-end verification
3. `apps/worker/src/test-worker.js` — worker test queries

---

## 12. Merge conflict resolution (`sakshi-dev`)

After merging `origin/sakshi-dev`, conflicts were resolved in favor of local Phase 1 ClickHouse work:

1. Kept **`events_raw`** (not `events`) in API, worker, DB queries, and verification scripts.
2. Kept Redis queue ingestion path (not direct API → ClickHouse insert).
3. Kept worker `instrument.js`, DLQ on validation errors, and Sentry on startup failure.

Merge commit: `1aab8e9` — _Merge origin/sakshi-dev: keep events_raw, Redis queue, worker instrument and DLQ_

---

## 13. Environment variables

ClickHouse connection uses:

- `CLICKHOUSE_URL`
- `CLICKHOUSE_USER` (default: `default`)
- `CLICKHOUSE_PASSWORD`

Used by: API, worker, `init-clickhouse.ts`, and verification scripts.

---

## 14. Docker / local infra

1. `docker-compose.yml` includes a ClickHouse service for local development (`pnpm dev:infra`).
2. API Dockerfile downloads GeoIP separately; ClickHouse schema is applied via `ensureEventsTable` on API startup or `init-clickhouse.ts` manually.

---

## Files changed (ClickHouse-related)

| Area              | Files                                                                          |
| ----------------- | ------------------------------------------------------------------------------ |
| Table constant    | `apps/api/src/lib/clickhouse-events-table.ts`                                  |
| API service       | `apps/api/src/services/clickhouse.service.ts`                                  |
| Migration script  | `init-clickhouse.ts`                                                           |
| Worker insert     | `apps/worker/src/processor/dbWriter.js`, `apps/worker/src/index.js`            |
| Validation / PII  | `apps/worker/src/processor/validator.js`, `apps/worker/src/processor/pii.js`   |
| Analytics queries | `apps/api/src/services/analytics-*.service.ts`                                 |
| Cache layer       | `apps/api/src/lib/analytics-cache.ts`                                          |
| Shared queries    | `packages/database/src/queries/events.ts`                                      |
| Health            | `apps/api/src/routes/health.ts`                                                |
| Verification      | `run_verification.mjs`, `verify_pipeline.ts`, `apps/worker/src/test-worker.js` |
