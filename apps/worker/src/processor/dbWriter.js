import * as Sentry from '@sentry/node';
import { sendAlertWebhook } from '../alert-webhook.js';

const CLICKHOUSE_EVENTS_TABLE = 'events_raw';
const CLICKHOUSE_HEATMAP_TABLE = 'heatmap_events';


export class DbWriter {
  constructor(clickHouseClient, redisClient) {
    this.clickHouseClient = clickHouseClient;
    this.redisClient = redisClient;
  }

 
  async flushBatch(batch) {
    if (!batch || batch.length === 0) return;

    const deduped = [];
    const seenEventIds = new Set();
    for (let i = batch.length - 1; i >= 0; i -= 1) {
      const event = batch[i];
      const eventId =
        typeof event?.event_id === 'string' ? event.event_id.trim() : '';
      if (eventId) {
        if (seenEventIds.has(eventId)) continue;
        seenEventIds.add(eventId);
      }
      deduped.push(event);
    }
    deduped.reverse();

    try {
      await this.clickHouseClient.insert({
        table: CLICKHOUSE_EVENTS_TABLE,
        values: deduped,
        format: 'JSONEachRow',
      });
      console.log(`[Worker] Flushed ${deduped.length} events to ClickHouse.`);
    } catch (err) {
      console.error(`[Worker] Failed to insert ${deduped.length} events to ClickHouse:`, err.message);
      
      void sendAlertWebhook({
        title: 'Worker ClickHouse insert failed',
        body: `${deduped.length} events moved to DLQ. ${err.message}`,
        severity: 'critical',
        source: 'worker.clickhouse.insert',
      });

      Sentry.captureException(err, {
        extra: {
          batchSize: deduped.length,
        }
      });

      try {
        const dlqPayload = JSON.stringify({
          events: deduped,
          error: err.message,
          timestamp: Date.now()
        });
        await this.redisClient.lpush('failed_events', dlqPayload);
        console.log(`[Worker] Pushed failed batch to 'failed_events' DLQ.`);
      } catch (dlqErr) {
        console.error('[Worker] CRITICAL ERROR: Failed to push to DLQ', dlqErr);
        Sentry.captureException(dlqErr);

      }
    }
  }


  async flushHeatmapBatch(batch) {
    if (!batch || batch.length === 0) return;

    try {
      await this.clickHouseClient.insert({
        table: CLICKHOUSE_HEATMAP_TABLE,
        values: batch,
        format: 'JSONEachRow',
      });
      console.log(`[Worker] Flushed ${batch.length} heatmap events to ClickHouse.`);
    } catch (err) {
      console.error(`[Worker] Failed to insert ${batch.length} heatmap events to ClickHouse:`, err.message);
      
      void sendAlertWebhook({
        title: 'Worker ClickHouse heatmap insert failed',
        body: `${batch.length} heatmap events moved to DLQ. ${err.message}`,
        severity: 'critical',
        source: 'worker.clickhouse.heatmap_insert',
      });

      Sentry.captureException(err, {
        extra: {
          batchSize: batch.length,
        }
      });

      try {
        const dlqPayload = JSON.stringify({
          events: batch,
          error: err.message,
          timestamp: Date.now(),
          type: 'heatmap'
        });
        await this.redisClient.lpush('failed_events', dlqPayload);
        console.log(`[Worker] Pushed failed heatmap batch to 'failed_events' DLQ.`);
      } catch (dlqErr) {
        console.error('[Worker] CRITICAL ERROR: Failed to push heatmap to DLQ', dlqErr);
        Sentry.captureException(dlqErr);
      }
    }
  }
}
