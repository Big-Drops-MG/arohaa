export type WebhookProvider = 'slack' | 'discord' | 'generic'

export type OutboundWebhookPayload = {
  title: string
  body: string
  severity: 'info' | 'warning' | 'critical'
  source: string
}

export function detectWebhookProvider(url: string): WebhookProvider {
  if (url.includes('discord.com/api/webhooks')) return 'discord'
  if (url.includes('hooks.slack.com')) return 'slack'
  return 'generic'
}

export function isAllowedWebhookUrl(raw: string): boolean {
  try {
    const url = new URL(raw.trim())
    if (url.protocol !== 'https:') return false
    return (
      url.hostname.endsWith('slack.com') ||
      url.hostname.endsWith('discord.com') ||
      url.hostname.endsWith('discordapp.com')
    )
  } catch {
    return false
  }
}

function severityLabel(severity: OutboundWebhookPayload['severity']): string {
  if (severity === 'critical') return '[CRITICAL]'
  if (severity === 'warning') return '[WARNING]'
  return '[INFO]'
}

export function buildWebhookBody(
  url: string,
  payload: OutboundWebhookPayload,
): string {
  const label = severityLabel(payload.severity)
  if (detectWebhookProvider(url) === 'discord') {
    const color =
      payload.severity === 'critical'
        ? 0xef4444
        : payload.severity === 'warning'
          ? 0xf59e0b
          : 0x3b82f6
    return JSON.stringify({
      embeds: [
        {
          title: `${label} ${payload.title}`,
          description: payload.body,
          color,
          footer: { text: payload.source },
        },
      ],
    })
  }

  return JSON.stringify({
    text: `${label} *${payload.title}*\n${payload.body}\n_Source: ${payload.source}_`,
  })
}

export async function postWebhook(
  url: string,
  payload: OutboundWebhookPayload,
): Promise<void> {
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: buildWebhookBody(url, payload),
    signal: AbortSignal.timeout(10_000),
  })
  if (!response.ok) {
    throw new Error(`Webhook failed: ${response.status}`)
  }
}

export async function postWebhookToMany(
  urls: string[],
  payload: OutboundWebhookPayload,
): Promise<void> {
  if (urls.length === 0) return
  await Promise.allSettled(urls.map((url) => postWebhook(url, payload)))
}
