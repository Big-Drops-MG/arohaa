/**
 * One-shot: re-score every submitted lead session that has usable IP geo
 * under LEAD_FRAUD_MODEL_VERSION v10 (UTM-source reputation).
 *
 * Usage (from repo root, with CLICKHOUSE_* loaded):
 *   npx tsx apps/api/scripts/backfill-lead-fraud-v10.mts
 *   npx tsx apps/api/scripts/backfill-lead-fraud-v10.mts --workspace <uuid>
 *   npx tsx apps/api/scripts/backfill-lead-fraud-v10.mts --dry-run
 *
 * Production: prefer POST /v1/warehouse/lead-fraud-backfill with x-arohaa-internal.
 */
import { readFileSync, existsSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

function loadEnvFile(path: string) {
  if (!existsSync(path)) return
  const text = readFileSync(path, 'utf8')
  for (const line of text.split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z_][A-Z0-9_]*)\s*=\s*(.*)\s*$/)
    if (m && !process.env[m[1]]) {
      process.env[m[1]] = m[2].replace(/^["']|["']$/g, '')
    }
  }
}

const here = dirname(fileURLToPath(import.meta.url))
const root = resolve(here, '../../..')
loadEnvFile(resolve(root, 'apps/dashboard/.env.local'))
loadEnvFile(resolve(root, 'apps/api/.env'))
loadEnvFile(resolve(root, '.env'))

const args = process.argv.slice(2)
const dryRun = args.includes('--dry-run')
const workspaceArgIdx = args.indexOf('--workspace')
const onlyWorkspace =
  workspaceArgIdx >= 0 ? (args[workspaceArgIdx + 1] || '').trim() : ''

const { backfillGeoLeadFraudAssessments } = await import(
  '../src/lib/lead-fraud/backfill-geo-leads.js'
)

const result = await backfillGeoLeadFraudAssessments({
  workspaceId: onlyWorkspace || undefined,
  dryRun,
  onProgress: (line) => console.log(`[backfill-v10] ${line}`),
})

console.log(JSON.stringify(result, null, 2))
process.exit(result.errors > 0 ? 1 : 0)
