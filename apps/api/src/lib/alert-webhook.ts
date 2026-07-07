export type AlertSeverity = 'info' | 'warning' | 'critical'

export type AlertWebhookPayload = {
  title: string
  body: string
  severity: AlertSeverity
  source: string
}

const COOLDOWN_MS = 60_000
const lastSentAt = new Map<string, number>()

function severityEmoji(severity: AlertSeverity): string {
  if (severity === 'critical') return '[CRITICAL]'
  if (severity === 'warning') return '[WARNING]'
  return '[INFO]'
}

function shouldSend(source: string): boolean {
  const now = Date.now()
  const last = lastSentAt.get(source) ?? 0
  if (now - last < COOLDOWN_MS) return false
  lastSentAt.set(source, now)
  return true
}

function resolveWebhookUrls(): string[] {
  const urls: string[] = []
  const slack = process.env.ALERT_WEBHOOK_SLACK_URL?.trim()
  const discord = process.env.ALERT_WEBHOOK_DISCORD_URL?.trim()
  if (slack) urls.push(slack)
  if (discord) urls.push(discord)
  return urls
}

function buildSlackBody(payload: AlertWebhookPayload): string {
  return JSON.stringify({
    text: `${severityEmoji(payload.severity)} *${payload.title}*\n${payload.body}\n_Source: ${payload.source}_`,
  })
}

function buildDiscordBody(payload: AlertWebhookPayload): string {
  const color =
    payload.severity === 'critical'
      ? 0xef4444
      : payload.severity === 'warning'
        ? 0xf59e0b
        : 0x3b82f6
  return JSON.stringify({
    embeds: [
      {
        title: `${severityEmoji(payload.severity)} ${payload.title}`,
        description: payload.body,
        color,
        footer: { text: payload.source },
      },
    ],
  })
}

function isDiscordWebhook(url: string): boolean {
  return url.includes('discord.com/api/webhooks')
}

export async function sendAlertWebhook(
  payload: AlertWebhookPayload,
): Promise<void> {
  if (!shouldSend(payload.source)) return

  const urls = resolveWebhookUrls()
  if (urls.length === 0) return

  await Promise.allSettled(
    urls.map(async (url) => {
      const body = isDiscordWebhook(url)
        ? buildDiscordBody(payload)
        : buildSlackBody(payload)
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body,
        signal: AbortSignal.timeout(10_000),
      })
      if (!response.ok) {
        throw new Error(`Webhook failed: ${response.status}`)
      }
    }),
  )
}

export function resetAlertWebhookCooldownForTests(): void {
  lastSentAt.clear()
}
