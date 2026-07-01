import { Redis } from 'ioredis';
import { createClient } from '@clickhouse/client';
import * as dotenv from 'dotenv';
import path from 'path';
import { spawn } from 'child_process';
import { getEvents } from './packages/database/src/queries/events.ts';

const redis = new Redis('rediss://default:gQAAAAAAATh5AAIgcDEyODViNzc1NTVjZDE0NGM3OGZkNThjM2YyOTUzZDcyYg@open-seahorse-79993.upstash.io:6379');
const clickhouse = createClient({
  url: 'https://ffr4i97d24.us-east-1.aws.clickhouse.cloud:8443',
  username: 'default',
  password: '9e_BpmsvufWbr',
});
process.env.REDIS_URL = 'rediss://default:gQAAAAAAATh5AAIgcDEyODViNzc1NTVjZDE0NGM3OGZkNThjM2YyOTUzZDcyYg@open-seahorse-79993.upstash.io:6379';
process.env.CLICKHOUSE_URL = 'https://ffr4i97d24.us-east-1.aws.clickhouse.cloud:8443';
process.env.CLICKHOUSE_PASSWORD = '9e_BpmsvufWbr';
process.env.CLICKHOUSE_USER = 'default';

async function run() {
  const workspaceId = '11111111-1111-1111-1111-111111111111';
  
  console.log('--- Setting up test ---');
  // Clear any existing events for this test workspace in ClickHouse
  try {
    await clickhouse.query({
      query: `ALTER TABLE events DELETE WHERE workspace_id = '${workspaceId}'`,
      format: 'JSONEachRow'
    });
    // Wait a bit for mutation
    await new Promise(r => setTimeout(r, 2000));
  } catch (e) {
    console.log('Could not clear test events (maybe table is new)', e.message);
  }

  console.log('1. Pushing test events to analytics_queue...');
  const validEvent = {
    event_name: 'pipeline_test_event',
    workspace_id: workspaceId,
    user_id: 'test@example.com', // PII masking target
    created_at: new Date().toISOString(),
  };

  const invalidEventWorkspace = {
    event_name: 'pipeline_test_event',
    created_at: new Date().toISOString(), // Missing workspace_id
  };

  const invalidEventName = {
    workspace_id: workspaceId,
    created_at: new Date().toISOString(), // Missing event_name
  };

  await redis.lpush('analytics_queue', JSON.stringify(validEvent));
  await redis.lpush('analytics_queue', JSON.stringify(invalidEventWorkspace));
  await redis.lpush('analytics_queue', JSON.stringify(invalidEventName));
  console.log('   Pushed 3 events (1 valid, 2 invalid).');

  console.log('\n2. Starting Worker...');
  const workerEnv = { ...process.env, REDIS_URL: process.env.REDIS_URL, CLICKHOUSE_URL: process.env.CLICKHOUSE_URL };
  const worker = spawn('node', ['apps/worker/src/index.js'], { env: workerEnv, stdio: 'pipe' });
  
  worker.stdout.on('data', d => process.stdout.write('   [Worker STDOUT] ' + d.toString()));
  worker.stderr.on('data', d => process.stdout.write('   [Worker STDERR] ' + d.toString()));

  // Wait 7 seconds for queue consumption and FLUSH_INTERVAL_MS to trigger
  await new Promise(r => setTimeout(r, 7000));
  
  console.log('\n3. Stopping Worker gracefully...');
  worker.kill('SIGINT');
  
  // Wait for shutdown
  await new Promise(r => setTimeout(r, 2000));

  console.log('\n4. Verifying in ClickHouse via Next.js Query Wrappers...');
  try {
    // using the event queries from the database package
    const events = await getEvents(clickhouse, { workspaceId });
    console.log(`   Found ${events.length} events for workspace ${workspaceId}`);
    
    if (events.length === 1) {
      console.log('   ✅ Workspace validation successful (dropped invalid ones).');
      const ev = events[0];
      if (ev.user_id && ev.user_id !== 'test@example.com' && ev.user_id.length === 64) {
         console.log('   ✅ PII masking successful (email hashed to: ' + ev.user_id + ').');
      } else {
         console.log('   ❌ PII masking failed or missing. user_id:', ev.user_id);
      }
    } else {
      console.log('   ❌ Expected exactly 1 event, got:', events.length);
    }
  } catch(e) {
    console.error('   ❌ Failed to query events:', e);
  }

  await redis.quit();
  await clickhouse.close();
}

run().catch(console.error);
