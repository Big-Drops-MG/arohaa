import * as Sentry from '@sentry/node';

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
      // The notion task specified 'INSERT INTO events_raw', but the schema defines 'events'.
      // We write to 'events' to match the current ClickHouse migration schema.
      await this.clickHouseClient.insert({
        table: 'events',
        values: batch,
        format: 'JSONEachRow',
      });
      console.log(`[Worker] Flushed ${batch.length} events to ClickHouse.`);
    } catch (err) {
      console.error(`[Worker] Failed to insert ${batch.length} events to ClickHouse:`, err.message);
      
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
}
