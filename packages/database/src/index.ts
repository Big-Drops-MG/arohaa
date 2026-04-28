import { createClient, type ClickHouseClient } from '@clickhouse/client';
import { config } from 'dotenv';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const monorepoRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../../../',
);

config({ path: path.join(monorepoRoot, '.env') });
config({ path: path.join(monorepoRoot, 'apps/dashboard/.env.local') });

const url = process.env.CLICKHOUSE_URL?.trim();

export const clickhouse: ClickHouseClient | null = url
  ? createClient({
      url,
      username: process.env.CLICKHOUSE_USER || 'default',
      password: process.env.CLICKHOUSE_PASSWORD,
    })
  : null;

export const db: null = null;
