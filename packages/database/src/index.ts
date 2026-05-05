import { neon } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-http';
import { config as loadEnv } from 'dotenv';
import { existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import * as authSchema from './schema/auth';
import * as tokenSchema from './schema/tokens';

const schema = {
  ...authSchema,
  ...tokenSchema,
};

function bootstrapEnv(): void {
  const moduleDir = dirname(fileURLToPath(import.meta.url));
  const candidates = [
    resolve(process.cwd(), '.env'),
    resolve(process.cwd(), '../../.env'),
    resolve(moduleDir, '../../../.env'),
  ];

  for (const path of candidates) {
    if (existsSync(path)) {
      loadEnv({ path, override: false });
    }
  }
}

bootstrapEnv();

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
export * from './schema/tokens';
export * from './email';

export const clickhouse = null;
