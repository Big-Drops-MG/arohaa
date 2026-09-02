export type WebhookProvider = 'slack' | 'discord' | 'generic'

export type OutboundWebhookPayload = {
  title: string
  body: string
  severity: 'info' | 'warning' | 'critical'
  source: string
}

const SLACK_HOST = 'hooks.slack.com'
const DISCORD_HOSTS = new Set(['discord.com', 'discordapp.com'])

export function detectWebhookProvider(url: string): WebhookProvider {
  if (url.includes('discord.com/api/webhooks')) return 'discord'
  if (url.includes('hooks.slack.com')) return 'slack'
  return 'generic'
}

function parseWebhookUrl(raw: string): URL | null {
  try {
    const url = new URL(raw.trim())
    if (url.protocol !== 'https:') return null
    if (url.username || url.password) return null
    if (url.port !== '' && url.port !== '443') return null
    return url
  } catch {
    return null
  }
}

export function isAllowedWebhookUrl(raw: string): boolean {
  const url = parseWebhookUrl(raw)
  if (!url) return false

  if (url.hostname === SLACK_HOST) {
    return url.pathname.startsWith('/services/')
  }

  if (DISCORD_HOSTS.has(url.hostname)) {
    return url.pathname.startsWith('/api/webhooks/')
  }

  return false
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
  if (!isAllowedWebhookUrl(url)) {
    throw new Error('Webhook URL not allowed')
  }

  const target = parseWebhookUrl(url)
  if (!target || !isAllowedWebhookUrl(target.toString())) {
    throw new Error('Webhook URL not allowed')
  }

  const response = await fetch(target.toString(), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: buildWebhookBody(url, payload),
    redirect: 'manual',
    signal: AbortSignal.timeout(10_000),
  })

  if (response.status >= 300 && response.status < 400) {
    throw new Error('Webhook redirects are not allowed')
  }

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
