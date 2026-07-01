import 'dotenv/config';
import { Redis } from 'ioredis';
import { createClient } from '@clickhouse/client';

const redis = new Redis('redis://127.0.0.1:6379');
const clickhouse = createClient({
  url: process.env.CLICKHOUSE_URL || 'http://localhost:8123',
  username: process.env.CLICKHOUSE_USER || 'default',
  password: process.env.CLICKHOUSE_PASSWORD || '',
});

async function run() {
  console.log('[Test] Flushing previous test events...');
  await redis.del('analytics_queue');
  await redis.del('failed_events');

  console.log('[Test] Pushing 3 valid events (one with PII)...');
  const validEvents = [
    {
      event_name: 'test_event_1',
      workspace_id: 'test-ws-1',
      user_id: 'john.doe@example.com',
      session_id: 's-1',
      properties: JSON.stringify({ email: 'John.Doe@example.com', plan: 'pro' })
    },
    {
      event_name: 'test_event_2',
      workspace_id: 'test-ws-2',
      user_id: 'u-1',
      session_id: 's-1',
      properties: '{}'
    },
    {
      event_name: 'test_event_3',
      workspace_id: 'test-ws-3',
      user_id: 'u-2',
      session_id: 's-2',
      properties: JSON.stringify({ other: 'data' })
    }
  ];

  for (const ev of validEvents) {
    await redis.rpush('analytics_queue', JSON.stringify(ev));
  }

  console.log('[Test] Pushing 1 invalid JSON event...');
  await redis.rpush('analytics_queue', '{ invalid_json: "yes" ');

  console.log('[Test] Events pushed. Start the worker now or wait 5s if it is already running...');
  
  setTimeout(async () => {
    // Check clickhouse
    const res = await clickhouse.query({
      query: 'SELECT * FROM events WHERE event_name LIKE \'test_event_%\' ORDER BY event_name',
      format: 'JSONEachRow'
    });
    const rows = await res.json();
    console.log('[Test] ClickHouse rows fetched:', rows.length);
    if (rows.length > 0) {
      console.log('Row 1 user_id (should be hashed):', rows[0].user_id);
      console.log('Row 1 properties:', rows[0].properties);
    }
    
    // Check DLQ
    const dlq = await redis.lrange('failed_events', 0, -1);
    console.log('[Test] Failed events in DLQ:', dlq.length);
    
    process.exit(0);
  }, 7000);
}

run();
