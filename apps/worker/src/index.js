import './instrument.js';
import { Redis } from 'ioredis';
import { createClient } from '@clickhouse/client';
import * as Sentry from '@sentry/node';
import { sendAlertWebhook } from './alert-webhook.js';
import { validateEvent, validateHeatmapEvent } from './processor/validator.js';
import { anonymizeEvent } from './processor/pii.js';
import { DbWriter } from './processor/dbWriter.js';
import { startFailedEventsReplay } from './processor/dlq-replay.js';
import { logger } from './logger.js';

const LOCAL_REDIS_URL = 'redis://127.0.0.1:6379';
const MAX_BATCH_SIZE = 1000;
const FLUSH_INTERVAL_MS = 5000;
const MAX_HEATMAP_BATCH_SIZE = 5000;
const HEATMAP_FLUSH_INTERVAL_MS = 2000;
const SHUTDOWN_DRAIN_MS = 8_000;

const PRIORITY_EVENT_NAMES = new Set([
  'form_success',
  'form_step_complete',
  'form_submit',
  'zip_submit',
]);


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
    return Math.min(times * 200, 30_000);
  }
});

redis.on('error', (err) => {
  logger.error({ err }, 'redis connection error');
});

redis.on('close', () => {
  logger.warn('redis connection closed; waiting for reconnect');
});

redis.on('reconnecting', (delay) => {
  logger.info({ delay }, 'redis reconnecting');
});


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


let isShuttingDown = false;
let batch = [];
let lastFlushTime = Date.now();

let heatmapBatch = [];
let lastHeatmapFlushTime = Date.now();
let stopFailedEventsReplay = () => {};

let inFlightAnalyticsPayload = null;
let inFlightHeatmapPayload = null;

let analyticsLoopDone = Promise.resolve();
let heatmapLoopDone = Promise.resolve();

async function requeueInFlight(queueName, payload) {
  if (!payload) return;
  try {
    await redis.lpush(queueName, payload);
    logger.info({ queue: queueName }, 'requeued in-flight payload on shutdown');
  } catch (err) {
    logger.error({ err, queue: queueName }, 'failed to requeue in-flight payload');
    try {
      await redis.lpush(
        'failed_events',
        JSON.stringify({
          reason: 'shutdown_requeue_failed',
          queue: queueName,
          payload,
          timestamp: Date.now(),
        }),
      );
    } catch (dlqErr) {
      logger.error({ err: dlqErr, queue: queueName }, 'failed to DLQ in-flight payload');
    }
  }
}

async function startQueueConsumption() {
  logger.info('starting queue consumption from analytics_queue');
  
  while (!isShuttingDown) {
    try {
      const result = await redis.blpop('analytics_queue', 1);
      
      let priorityFlush = false;
      if (result) {
        const [, payload] = result;
        inFlightAnalyticsPayload = payload;
        try {
          const rawEvent = JSON.parse(payload);
          if (validateEvent(rawEvent)) {
            const safeEvent = anonymizeEvent(rawEvent);
            batch.push(safeEvent);
            inFlightAnalyticsPayload = null;
            if (PRIORITY_EVENT_NAMES.has(safeEvent.event_name)) {
              priorityFlush = true;
            }
          } else {
            await redis.lpush('failed_events', JSON.stringify({ reason: 'validation_failed', payload, timestamp: Date.now() }));
            inFlightAnalyticsPayload = null;
          }
        } catch (parseErr) {
          logger.warn({ payload }, 'invalid JSON payload received');
          await redis.lpush('failed_events', JSON.stringify({ reason: 'json_parse_error', payload, timestamp: Date.now() }));
          inFlightAnalyticsPayload = null;
        }
      }

      const timeSinceFlush = Date.now() - lastFlushTime;
      if (
        batch.length >= MAX_BATCH_SIZE ||
        (batch.length > 0 && timeSinceFlush >= FLUSH_INTERVAL_MS) ||
        (batch.length > 0 && priorityFlush)
      ) {
        const currentBatch = [...batch];
        batch = [];
        lastFlushTime = Date.now();
        await dbWriter.flushBatch(currentBatch);
      }
      
    } catch (err) {
      if (isShuttingDown) break;
      logger.error({ err }, 'error in queue consumption loop');
      await new Promise(resolve => setTimeout(resolve, 1000)); 
    }
  }
}

async function startHeatmapConsumption() {
  logger.info('starting queue consumption from heatmap_queue');
  
  while (!isShuttingDown) {
    try {
      const result = await redis.blpop('heatmap_queue', 1);
      
      if (result) {
        const [, payload] = result;
        inFlightHeatmapPayload = payload;
        try {
          const rawEvent = JSON.parse(payload);
          if (validateHeatmapEvent(rawEvent)) {
            heatmapBatch.push(rawEvent);
            inFlightHeatmapPayload = null;
          } else {
            await redis.lpush('failed_events', JSON.stringify({ reason: 'validation_failed', payload, timestamp: Date.now(), type: 'heatmap' }));
            inFlightHeatmapPayload = null;
          }
        } catch (parseErr) {
          logger.warn({ payload }, 'invalid JSON payload received in heatmap_queue');
          await redis.lpush('failed_events', JSON.stringify({ reason: 'json_parse_error', payload, timestamp: Date.now(), type: 'heatmap' }));
          inFlightHeatmapPayload = null;
        }
      }

      const timeSinceFlush = Date.now() - lastHeatmapFlushTime;
      if (heatmapBatch.length >= MAX_HEATMAP_BATCH_SIZE || (heatmapBatch.length > 0 && timeSinceFlush >= HEATMAP_FLUSH_INTERVAL_MS)) {
        const currentBatch = [...heatmapBatch];
        heatmapBatch = [];
        lastHeatmapFlushTime = Date.now();
        await dbWriter.flushHeatmapBatch(currentBatch);
      }
      
    } catch (err) {
      if (isShuttingDown) break;
      logger.error({ err }, 'error in heatmap queue consumption loop');
      await new Promise(resolve => setTimeout(resolve, 1000)); 
    }
  }
}


async function shutdown(signal) {
  if (isShuttingDown) return;
  isShuttingDown = true;
  logger.info({ signal }, 'shutdown initiated');
  stopFailedEventsReplay();
  
  try {
    await Promise.race([
      Promise.all([analyticsLoopDone, heatmapLoopDone]),
      new Promise((resolve) => setTimeout(resolve, SHUTDOWN_DRAIN_MS)),
    ]);

    const pendingAnalytics = inFlightAnalyticsPayload;
    inFlightAnalyticsPayload = null;
    const pendingHeatmap = inFlightHeatmapPayload;
    inFlightHeatmapPayload = null;
    await requeueInFlight('analytics_queue', pendingAnalytics);
    await requeueInFlight('heatmap_queue', pendingHeatmap);

    if (batch.length > 0) {
      logger.info({ rows: batch.length }, 'flushing pending events before shutdown');
      const currentBatch = [...batch];
      batch = [];
      await dbWriter.flushBatch(currentBatch);
    }
    
    if (heatmapBatch.length > 0) {
      logger.info({ rows: heatmapBatch.length }, 'flushing pending heatmap events before shutdown');
      const currentBatch = [...heatmapBatch];
      heatmapBatch = [];
      await dbWriter.flushHeatmapBatch(currentBatch);
    }
    
    if (clickHouseClient) {
      await clickHouseClient.close();
      logger.info('clickhouse disconnected');
    }

    if (redis) {
      await redis.quit();
      logger.info('redis disconnected');
    }

    await Sentry.close(2000);

    logger.info('shutdown complete');
    process.exit(0);
  } catch (err) {
    logger.error({ err }, 'error during shutdown');
    process.exit(1);
  }
}

for (const signal of ['SIGINT', 'SIGTERM']) {
  process.once(signal, () => {
    void shutdown(signal);
  });
}


async function start() {
  logger.info('starting worker');

  try {
    await new Promise((resolve, reject) => {
      if (redis.status === 'ready') return resolve();
      redis.once('ready', resolve);
      redis.once('error', reject);
    });
    logger.info('redis connected');

    clickHouseClient = getClickHouseClient();
    dbWriter = new DbWriter(clickHouseClient, redis);

    const result = await clickHouseClient.query({
      query: 'SELECT 1 AS ok',
      format: 'JSON',
    });
    const json = await result.json();
    if (json?.data?.[0]?.ok !== 1) {
      throw new Error('ClickHouse ping failed.');
    }
    logger.info('clickhouse connected');

    try {
      await clickHouseClient.command({
        query: `ALTER TABLE events_raw ADD COLUMN IF NOT EXISTS event_id String DEFAULT ''`,
      });
    } catch (err) {
      logger.warn({ err }, 'failed to ensure events_raw.event_id column');
    }

    logger.info('worker ready');
    
    analyticsLoopDone = startQueueConsumption();
    heatmapLoopDone = startHeatmapConsumption();
    stopFailedEventsReplay = startFailedEventsReplay(redis);
  } catch (err) {
    logger.error({ err }, 'worker startup failed');
    void sendAlertWebhook({
      title: 'Worker startup failed',
      body: err instanceof Error ? err.message : String(err),
      severity: 'critical',
      source: 'worker.startup',
    });
    Sentry.captureException(err);
    await Sentry.flush(2000).catch(() => undefined);
    process.exit(1);
  }
}

start();
