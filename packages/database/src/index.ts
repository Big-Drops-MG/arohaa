import { neon } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-http';
import { bootstrapDatabaseEnv } from './config/env';
import * as authSchema from './schema/auth';
import * as landingSchema from './schema/landing-pages';
import * as tokenSchema from './schema/tokens';
import * as workspaceSchema from './schema/workspace';

const schema = {
  ...authSchema,
  ...landingSchema,
  ...workspaceSchema,
  ...tokenSchema,
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

export * from './schema/auth';
export * from './schema/landing-pages';
export * from './schema/workspace';
export * from './schema/tokens';
export * from './email';
export * from './landing/normalizeLandingPageUrl';
export * from './landing/generatePublicLandingId';
export * from './landing/htmlVerificationToken';

export const clickhouse = null;
