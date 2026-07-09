import { neon } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-http';
import { createClient, ClickHouseClient } from '@clickhouse/client';
import { bootstrapDatabaseEnv } from './config/env.js';
import * as authSchema from './schema/auth.js';
import * as landingSchema from './schema/landing-pages.js';
import * as tokenSchema from './schema/tokens.js';
import * as workspaceSchema from './schema/workspace.js';
import * as experimentsSchema from './schema/experiments.js';
import * as notificationsSchema from './schema/notifications.js';
import * as seoSchema from './schema/seo.js';
import * as workspaceApiKeysSchema from './schema/workspace-api-keys.js';
import * as workspaceAlertWebhooksSchema from './schema/workspace-alert-webhooks.js';
import * as landingPageUtmParamsSchema from './schema/landing-page-utm-params.js';

const schema = {
  ...authSchema,
  ...landingSchema,
  ...workspaceSchema,
  ...tokenSchema,
  ...experimentsSchema,
  ...notificationsSchema,
  ...seoSchema,
  ...workspaceApiKeysSchema,
  ...workspaceAlertWebhooksSchema,
  ...landingPageUtmParamsSchema,
};

bootstrapDatabaseEnv(import.meta.url);

function resolveDatabaseUrl(): string {
  const url =
    process.env.DATABASE_URL ??
    process.env.POSTGRES_PRISMA_URL ??
    process.env.POSTGRES_URL
  if (!url) {
    throw new Error(
      'No database URL. Set DATABASE_URL (or POSTGRES_PRISMA_URL / POSTGRES_URL for Neon/Vercel).',
    )
  }
  return url
}

const sql = neon(resolveDatabaseUrl());
export const db = drizzle(sql, { schema });

export * from './schema/auth.js';
export * from './schema/landing-pages.js';
export * from './schema/workspace.js';
export * from './schema/tokens.js';
export * from './schema/experiments.js';
export * from './schema/notifications.js';
export * from './schema/seo.js';
export * from './schema/workspace-api-keys.js';
export * from './schema/workspace-alert-webhooks.js';
export * from './schema/landing-page-utm-params.js';
export * from './email.js';
export * from './notifications/create-notification.js';
export * from './landing/normalizeLandingPageUrl.js';
export * from './landing/generatePublicLandingId.js';
export * from './landing/htmlVerificationToken.js';
export * from './workspace-api-keys/api-key.js';
export * from './alert-webhooks/dispatch.js';

export * from 'drizzle-orm';

export let clickhouse: ClickHouseClient | null = null;
if (process.env.CLICKHOUSE_URL) {
  clickhouse = createClient({
    url: process.env.CLICKHOUSE_URL,
    username: process.env.CLICKHOUSE_USER || 'default',
    password: process.env.CLICKHOUSE_PASSWORD || '',
  });
}

export * from './queries/events.js';
