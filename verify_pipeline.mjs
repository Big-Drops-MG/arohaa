import { Redis } from 'ioredis';
import { createClient } from '@clickhouse/client';
import * as dotenv from 'dotenv';
import path from 'path';

// Load env from apps/api/.env.example (which has the real URLs stored based on the previous stash pop)
dotenv.config({ path: path.join(process.cwd(), 'apps/api/.env.example') });

const redis = new Redis(process.env.REDIS_URL);
const clickhouse = createClient({
  url: process.env.CLICKHOUSE_URL,
  username: process.env.CLICKHOUSE_USER || 'default',
  password: process.env.CLICKHOUSE_PASSWORD || '',
});

async function run() {
  const workspaceId = '00000000-0000-0000-0000-000000000000';
  
  console.log('1. Pushing test events to analytics_queue...');
  
  const validEvent = {
    event_name: 'pipeline_test_event',
    workspace_id: workspaceId,
    user_id: 'test@example.com', // To test PII masking
    created_at: new Date().toISOString(),
  };

  const invalidEventMissingWorkspace = {
    event_name: 'pipeline_test_event',
    // Missing workspace_id
    created_at: new Date().toISOString(),
  };

  const invalidEventMissingName = {
    workspace_id: workspaceId,
    // Missing event_name
    created_at: new Date().toISOString(),
  };

  // Push to Redis
  await redis.lpush('analytics_queue', JSON.stringify(validEvent));
  await redis.lpush('analytics_queue', JSON.stringify(invalidEventMissingWorkspace));
  await redis.lpush('analytics_queue', JSON.stringify(invalidEventMissingName));
  console.log('Events pushed to Redis.');
  
  console.log('\n2. Please start the worker in a separate terminal: node apps/worker/src/index.js');
  console.log('Or I will spawn it in the background now for 10 seconds...');
  
  // We will exit here so I can run the worker in the next step
  await redis.quit();
  await clickhouse.close();
}

run().catch(console.error);
