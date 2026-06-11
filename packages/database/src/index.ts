import { neon } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-http';
import { bootstrapDatabaseEnv } from './config/env.js';
import * as authSchema from './schema/auth.js';
import * as landingSchema from './schema/landing-pages.js';
import * as tokenSchema from './schema/tokens.js';
import * as workspaceSchema from './schema/workspace.js';
import * as experimentsSchema from './schema/experiments.js';

const schema = {
  ...authSchema,
  ...landingSchema,
  ...workspaceSchema,
  ...tokenSchema,
  ...experimentsSchema,
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
export * from './email.js';
export * from './landing/normalizeLandingPageUrl.js';
export * from './landing/generatePublicLandingId.js';
export * from './landing/htmlVerificationToken.js';

export * from 'drizzle-orm';

export const clickhouse = null;
