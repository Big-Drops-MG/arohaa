import { existsSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { config as loadEnv } from 'dotenv'
import * as Sentry from '@sentry/node'

loadLocalEnv()

const dsn = process.env.SENTRY_DSN?.trim()
const environment = process.env.NODE_ENV ?? 'development'

if (dsn) {
  Sentry.init({
    dsn,
    environment,
    tracesSampleRate: environment === 'production' ? 0.1 : 1.0,
    sendDefaultPii: false,
  })
  // eslint-disable-next-line no-console
  console.log(`[sentry] enabled (env=${environment})`)
} else {
  // eslint-disable-next-line no-console
  console.log('[sentry] disabled (no SENTRY_DSN set)')
}

export const sentryEnabled = Boolean(dsn)

function loadLocalEnv(): void {
  const here = path.dirname(fileURLToPath(import.meta.url))
  const apiRoot = path.resolve(here, '..')
  const repoRoot = path.resolve(apiRoot, '..', '..')
  const candidates = [
    path.join(apiRoot, '.env.local'),
    path.join(apiRoot, '.env'),
    path.join(repoRoot, 'apps', 'dashboard', '.env.local'),
  ]

  for (const file of candidates) {
    if (existsSync(file)) {
      loadEnv({ path: file })
    }
  }
}
