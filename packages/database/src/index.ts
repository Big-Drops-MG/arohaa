import { neon } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-http';
import * as authSchema from './schema/auth.js';
import * as tokenSchema from './schema/tokens.js';

const schema = {
  ...authSchema,
  ...tokenSchema,
};

const sql = neon(process.env.DATABASE_URL!);
export const db = drizzle(sql, { schema });

export * from './schema/auth.js';
export * from './schema/tokens.js';

export const clickhouse = null;
