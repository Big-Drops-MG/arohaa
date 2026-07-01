import 'dotenv/config';
import { Redis } from 'ioredis';
import { createClient } from '@clickhouse/client';
import * as Sentry from '@sentry/node';
import crypto from 'crypto';
import { validateEvent } from './processor/validator.js';
import { DbWriter } from './processor/dbWriter.js';

const LOCAL_REDIS_URL = 'redis://127.0.0.1:6379';
const MAX_BATCH_SIZE = 1000;
const FLUSH_INTERVAL_MS = 5000;

// Initialize Sentry if configured
if (process.env.SENTRY_DSN) {
  Sentry.init({
    dsn: process.env.SENTRY_DSN,
    environment: process.env.NODE_ENV || 'development',
  });
}

//
// 1. Redis Connection Initialization
//
function resolveRedisUrl() {
  const candidates = [
    process.env.REDIS_URL,
    process.env.UPSTASH_REDIS_URL,
    process.env.KV_URL,
  ];

  for (const value of candidates) {
    const trimmed = value?.trim();
    if (trimmed) return trimmed;
  }

  if (process.env.NODE_ENV === 'production') {
    throw new Error('REDIS_URL environment variable is missing.');
  }

  return LOCAL_REDIS_URL;
}

const redis = new Redis(resolveRedisUrl(), {
  maxRetriesPerRequest: null,
  enableReadyCheck: true,
  retryStrategy(times) {
    if (times > 3) return null; // stop retrying
    return Math.min(times * 50, 2000);
  }
});

redis.on('error', (err) => {
  console.error('[Worker] Redis connection error:', err.message);
});

//
// 2. ClickHouse Connection Initialization
//
function getClickHouseClient() {
  const url = process.env.CLICKHOUSE_URL?.trim();
  if (!url) throw new Error('CLICKHOUSE_URL is not configured.');

  return createClient({
    url,
    username: process.env.CLICKHOUSE_USER?.trim() ?? 'default',
    password: process.env.CLICKHOUSE_PASSWORD?.trim() ?? '',
    request_timeout: 10_000,
    clickhouse_settings: {
      async_insert: 1,
      wait_for_async_insert: 1,
    },
  });
}

let clickHouseClient = null;
let dbWriter = null;

//
// 3. Worker State and Processing Logic
//
let isShuttingDown = false;
let batch = [];
let lastFlushTime = Date.now();

// Email regex pattern for simple detection
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function hashEmail(email) {
  return crypto.createHash('sha256').update(email.trim().toLowerCase()).digest('hex');
}

function anonymizeEvent(event) {
  if (!event) return event;
  const cloned = { ...event };

  // Mask top-level user_id if it looks like an email
  if (typeof cloned.user_id === 'string' && EMAIL_REGEX.test(cloned.user_id)) {
    cloned.user_id = hashEmail(cloned.user_id);
  }

  // Parse and mask properties if present
  if (typeof cloned.properties === 'string') {
    try {
      const props = JSON.parse(cloned.properties);
      let modified = false;
      
      // Look for standard email fields in properties
      if (typeof props.email === 'string' && EMAIL_REGEX.test(props.email)) {
        props.email = hashEmail(props.email);
        modified = true;
      }
      
      if (modified) {
        cloned.properties = JSON.stringify(props);
      }
    } catch (e) {
      // Ignore JSON parse errors for properties
    }
  }

  return cloned;
}

// Removed flushBatch() - now handled by DbWriter

async function startQueueConsumption() {
  console.log('[Worker] Starting queue consumption from "analytics_queue"...');
  
  while (!isShuttingDown) {
    try {
      // BLPOP blocks for 1 second waiting for an item
      const result = await redis.blpop('analytics_queue', 1);
      
      if (result) {
        const [, payload] = result;
        try {
          const rawEvent = JSON.parse(payload);
          if (validateEvent(rawEvent)) {
            const safeEvent = anonymizeEvent(rawEvent);
            batch.push(safeEvent);
          }
        } catch (parseErr) {
          console.error('[Worker] Invalid JSON payload received, skipping.', payload);
          // Invalid JSON is dropped. Could also push to a separate DLQ if desired.
        }
      }

      // Check if we need to flush
      const timeSinceFlush = Date.now() - lastFlushTime;
      if (batch.length >= MAX_BATCH_SIZE || (batch.length > 0 && timeSinceFlush >= FLUSH_INTERVAL_MS)) {
        const currentBatch = [...batch];
        batch = [];
        lastFlushTime = Date.now();
        await dbWriter.flushBatch(currentBatch);
      }
      
    } catch (err) {
      console.error('[Worker] Error in queue consumption loop:', err.message);
      // Brief pause to prevent tight looping on Redis connection issues
      await new Promise(resolve => setTimeout(resolve, 1000)); 
    }
  }
}

//
// 4. Graceful Shutdown Handling
//
async function shutdown(signal) {
  if (isShuttingDown) return; // Prevent double execution
  isShuttingDown = true;
  console.log(`\n[Worker] Shutdown initiated (received ${signal})`);
  
  try {
    // 1. Flush any remaining events in the batch
    if (batch.length > 0) {
      console.log(`[Worker] Flushing ${batch.length} pending events before shutdown...`);
      const currentBatch = [...batch];
      batch = [];
      await dbWriter.flushBatch(currentBatch);
    }
    
    // 2. Close ClickHouse connection
    if (clickHouseClient) {
      await clickHouseClient.close();
      console.log('[Worker] ClickHouse disconnected');
    }

    // 3. Close Redis connection
    if (redis) {
      await redis.quit();
      console.log('[Worker] Redis disconnected');
    }

    // Flush Sentry events
    await Sentry.close(2000);

    console.log('[Worker] Shutdown complete');
    process.exit(0);
  } catch (err) {
    console.error('[Worker] Error during shutdown:', err);
    process.exit(1);
  }
}

for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => shutdown(signal));
}

//
// 5. Startup Sequence
//
async function start() {
  console.log('[Worker] Starting...');

  try {
    // Wait for Redis to be ready
    await new Promise((resolve, reject) => {
      if (redis.status === 'ready') return resolve();
      redis.once('ready', resolve);
      redis.once('error', reject);
    });
    console.log('[Worker] Redis connected');

    // Initialize ClickHouse client
    clickHouseClient = getClickHouseClient();
    dbWriter = new DbWriter(clickHouseClient, redis);

    // Validate ClickHouse connection
    const result = await clickHouseClient.query({
      query: 'SELECT 1 AS ok',
      format: 'JSON',
    });
    const json = await result.json();
    if (json?.data?.[0]?.ok !== 1) {
      throw new Error('ClickHouse ping failed.');
    }
    console.log('[Worker] ClickHouse connected');

    console.log('[Worker] Ready');
    
    // Start processing
    startQueueConsumption();
  } catch (err) {
    console.error('[Worker] Startup failed');
    console.error(err);
    process.exit(1);
  }
}

start();
