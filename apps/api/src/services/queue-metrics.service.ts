import {
  CloudWatchClient,
  PutMetricDataCommand,
  type MetricDatum,
} from '@aws-sdk/client-cloudwatch'
import type { FastifyBaseLogger } from 'fastify'
import { sendAlertWebhook } from '../lib/alert-webhook.js'
import { redis } from './redis.service.js'

const NAMESPACE = 'Arohaa/Custom'
const DEFAULT_INTERVAL_MS = 60_000
const DEFAULT_QUEUE_ALERT_THRESHOLD = 5000
const DEFAULT_DLQ_ALERT_THRESHOLD = 100

let timer: NodeJS.Timeout | null = null
let logger: FastifyBaseLogger | undefined
let cloudWatchClient: CloudWatchClient | null = null

function parsePositiveInt(raw: string | undefined, fallback: number): number {
  const value = Number(raw?.trim())
  return Number.isFinite(value) && value > 0 ? Math.floor(value) : fallback
}

function getCloudWatchClient(): CloudWatchClient | null {
  const region = process.env.AWS_REGION?.trim() || 'us-east-1'
  const accessKeyId = process.env.AWS_ACCESS_KEY_ID?.trim()
  const secretAccessKey = process.env.AWS_SECRET_ACCESS_KEY?.trim()

  if (!accessKeyId || !secretAccessKey) return null

  if (!cloudWatchClient) {
    cloudWatchClient = new CloudWatchClient({
      region,
      credentials: { accessKeyId, secretAccessKey },
    })
  }

  return cloudWatchClient
}

async function readQueueDepths(): Promise<{
  analyticsQueue: number
  failedEvents: number
}> {
  const [analyticsQueue, failedEvents] = await Promise.all([
    redis.llen('analytics_queue').catch(() => -1),
    redis.llen('failed_events').catch(() => -1),
  ])

  return { analyticsQueue, failedEvents }
}

async function publishQueueMetrics(
  analyticsQueue: number,
  failedEvents: number,
): Promise<void> {
  const client = getCloudWatchClient()
  if (!client) return
  if (analyticsQueue < 0 && failedEvents < 0) return

  const metricData: MetricDatum[] = []
  if (analyticsQueue >= 0) {
    metricData.push({
      MetricName: 'analytics_queue_depth',
      Value: analyticsQueue,
      Unit: 'Count',
    })
  }
  if (failedEvents >= 0) {
    metricData.push({
      MetricName: 'failed_events_depth',
      Value: failedEvents,
      Unit: 'Count',
    })
  }

  if (metricData.length === 0) return

  await client.send(
    new PutMetricDataCommand({
      Namespace: NAMESPACE,
      MetricData: metricData,
    }),
  )
}

async function maybeAlertOnQueueDepths(
  analyticsQueue: number,
  failedEvents: number,
): Promise<void> {
  const queueThreshold = parsePositiveInt(
    process.env.QUEUE_ALERT_THRESHOLD,
    DEFAULT_QUEUE_ALERT_THRESHOLD,
  )
  const dlqThreshold = parsePositiveInt(
    process.env.DLQ_ALERT_THRESHOLD,
    DEFAULT_DLQ_ALERT_THRESHOLD,
  )

  if (analyticsQueue >= queueThreshold) {
    void sendAlertWebhook({
      title: 'Analytics queue depth high',
      body: `analytics_queue=${analyticsQueue} (threshold ${queueThreshold})`,
      severity: 'warning',
      source: 'api.queue.monitor',
    })
  }

  if (failedEvents >= dlqThreshold) {
    void sendAlertWebhook({
      title: 'Failed events DLQ depth high',
      body: `failed_events=${failedEvents} (threshold ${dlqThreshold})`,
      severity: 'warning',
      source: 'api.dlq.monitor',
    })
  }
}

async function sampleQueues(reason: string): Promise<void> {
  try {
    const { analyticsQueue, failedEvents } = await readQueueDepths()
    await publishQueueMetrics(analyticsQueue, failedEvents)
    await maybeAlertOnQueueDepths(analyticsQueue, failedEvents)

    logger?.debug(
      {
        reason,
        analyticsQueue,
        failedEvents,
      },
      'queue depth sample',
    )
  } catch (err) {
    logger?.warn({ err, reason }, 'queue depth sample failed')
  }
}

export function startQueueDepthMonitor(options?: {
  logger?: FastifyBaseLogger
  intervalMs?: number
}): void {
  logger = options?.logger
  const intervalMs = parsePositiveInt(
    process.env.QUEUE_METRICS_INTERVAL_MS,
    options?.intervalMs ?? DEFAULT_INTERVAL_MS,
  )

  if (timer) return

  void sampleQueues('startup')

  timer = setInterval(() => {
    void sampleQueues('interval')
  }, intervalMs)

  if (typeof timer.unref === 'function') {
    timer.unref()
  }

  logger?.info(
    {
      intervalMs,
      namespace: NAMESPACE,
      cloudwatchEnabled: Boolean(getCloudWatchClient()),
    },
    'queue depth monitor started',
  )
}

export async function stopQueueDepthMonitor(): Promise<void> {
  if (timer) {
    clearInterval(timer)
    timer = null
  }
  await sampleQueues('shutdown')
}

export async function getQueueDepthsForHealth(): Promise<{
  analytics_queue: number
  failed_events: number
}> {
  const { analyticsQueue, failedEvents } = await readQueueDepths()
  return {
    analytics_queue: analyticsQueue,
    failed_events: failedEvents,
  }
}
