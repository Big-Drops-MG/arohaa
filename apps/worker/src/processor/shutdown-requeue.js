
export async function requeueInFlight(redis, queueName, payload, log = console) {
  if (!payload) return { action: 'noop' }

  try {
    await redis.lpush(queueName, payload)
    log.info?.({ queue: queueName }, 'requeued in-flight payload on shutdown')
    return { action: 'requeued', queue: queueName }
  } catch (err) {
    log.error?.({ err, queue: queueName }, 'failed to requeue in-flight payload')
    try {
      await redis.lpush(
        'failed_events',
        JSON.stringify({
          reason: 'shutdown_requeue_failed',
          queue: queueName,
          payload,
          timestamp: Date.now(),
        }),
      )
      return { action: 'dlq', queue: queueName }
    } catch (dlqErr) {
      log.error?.({ err: dlqErr, queue: queueName }, 'failed to DLQ in-flight payload')
      return { action: 'lost', queue: queueName }
    }
  }
}


export function takeInFlightPayload(slot) {
  const payload = slot.current
  slot.current = null
  return payload
}
