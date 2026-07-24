import * as Sentry from '@sentry/node';
import { sendAlertWebhook } from '../alert-webhook.js';

const CLICKHOUSE_EVENTS_TABLE = 'events_raw';
const CLICKHOUSE_HEATMAP_TABLE = 'heatmap_events';

/**
 * Handles database inserts for the worker.
 * Task 1: Insert processed events into database.
 */
export class DbWriter {
  constructor(clickHouseClient, redisClient) {
    this.clickHouseClient = clickHouseClient;
    this.redisClient = redisClient;
  }

  /**
   * Flushes a batch of events to ClickHouse.
   * @param {Array} batch The batch of validated and anonymized events.
   */
  async flushBatch(batch) {
    if (!batch || batch.length === 0) return;

    try {
      await this.clickHouseClient.insert({
        table: CLICKHOUSE_EVENTS_TABLE,
        values: batch,
        format: 'JSONEachRow',
      });
      console.log(`[Worker] Flushed ${batch.length} events to ClickHouse.`);
    } catch (err) {
      console.error(`[Worker] Failed to insert ${batch.length} events to ClickHouse:`, err.message);
      
      void sendAlertWebhook({
        title: 'Worker ClickHouse insert failed',
        body: `${batch.length} events moved to DLQ. ${err.message}`,
        severity: 'critical',
        source: 'worker.clickhouse.insert',
      });

      Sentry.captureException(err, {
        extra: {
          batchSize: batch.length,
          firstEvent: batch[0]
        }
      });

      // Push to dead letter queue
      try {
        const dlqPayload = JSON.stringify({
          events: batch,
          error: err.message,
          timestamp: Date.now()
        });
        await this.redisClient.lpush('failed_events', dlqPayload);
        console.log(`[Worker] Pushed failed batch to 'failed_events' DLQ.`);
      } catch (dlqErr) {
        console.error('[Worker] CRITICAL ERROR: Failed to push to DLQ', dlqErr);
        Sentry.captureException(dlqErr);
        // In extreme cases where Redis also fails, the batch is lost. 
        // But we attempted to save it.
      }
    }
  }

  /**
   * Flushes a batch of heatmap events to ClickHouse.
   * @param {Array} batch The batch of validated and anonymized heatmap events.
   */
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
          firstEvent: batch[0]
        }
      });

      // Push to dead letter queue
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
