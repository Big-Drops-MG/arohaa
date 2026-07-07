import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { config as loadEnv } from 'dotenv';
import * as Sentry from '@sentry/node';

loadLocalEnv();

const dsn = process.env.SENTRY_DSN?.trim();
const environment = process.env.NODE_ENV ?? 'development';

if (dsn) {
  Sentry.init({
    dsn,
    environment,
    tracesSampleRate: environment === 'production' ? 0.1 : 1.0,
    sendDefaultPii: false,
  });
  // eslint-disable-next-line no-console
  console.log(`[sentry] enabled (env=${environment})`);
} else {
  // eslint-disable-next-line no-console
  console.log('[sentry] disabled (no SENTRY_DSN set)');
}

process.on('uncaughtException', (err) => {
  Sentry.captureException(err);
  void Sentry.flush(2000).finally(() => process.exit(1));
});

process.on('unhandledRejection', (reason) => {
  Sentry.captureException(reason);
});

function loadLocalEnv() {
  const here = path.dirname(fileURLToPath(import.meta.url));
  const workerRoot = path.resolve(here, '..');
  const repoRoot = path.resolve(workerRoot, '..', '..');
  const candidates = [
    path.join(workerRoot, '.env.local'),
    path.join(workerRoot, '.env'),
    path.join(repoRoot, '.env.local'),
    path.join(repoRoot, '.env'),
    path.join(repoRoot, 'apps', 'dashboard', '.env.local'),
    path.join(repoRoot, 'apps', 'dashboard', '.env'),
  ];

  for (const file of candidates) {
    if (existsSync(file)) {
      loadEnv({ path: file });
    }
  }
}

export const sentryEnabled = Boolean(dsn);
