import { neon } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-http';
import * as authSchema from './schema/auth';
import * as tokenSchema from './schema/tokens';

const schema = {
  ...authSchema,
  ...tokenSchema,
};

const sql = neon(process.env.DATABASE_URL!);
export const db = drizzle(sql, { schema });

export * from './schema/auth';
export * from './schema/tokens';
export * from './email';

export const clickhouse = null;
