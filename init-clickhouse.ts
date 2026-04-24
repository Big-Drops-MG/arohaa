import { createClient } from '@clickhouse/client';
import 'dotenv/config';
import { config } from 'dotenv';
import path from 'node:path';

config({ path: path.resolve(process.cwd(), 'apps/dashboard/.env.local') });

const url = process.env.CLICKHOUSE_URL?.trim();
if (!url) {
  console.error(
    'Missing CLICKHOUSE_URL. Set CLICKHOUSE_* in apps/dashboard/.env.local or .env at the repo root.',
  );
  process.exit(1);
}

const client = createClient({
  url,
  username: process.env.CLICKHOUSE_USER || 'default',
  password: process.env.CLICKHOUSE_PASSWORD,
});

const query = `
CREATE TABLE IF NOT EXISTS events (
    id UUID,
    workspace_id UUID,
    session_id String,
    event_name String,
    url String,
    referrer String,
    browser String,
    os String,
    device String,
    created_at DateTime64(3)
) ENGINE = MergeTree()
ORDER BY (workspace_id, toDate(created_at), event_name)
PARTITION BY toYYYYMM(created_at);
`;

async function init() {
  try {
    console.log('Connecting to ClickHouse Cloud...');
    await client.exec({ query });
    console.log('Events table successfully created in ClickHouse Cloud!');
  } catch (error) {
    console.error('Error creating table:', error);
  } finally {
    await client.close();
  }
}

init();
