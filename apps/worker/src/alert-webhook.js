const COOLDOWN_MS = 60_000;
const lastSentAt = new Map();

function severityLabel(severity) {
  if (severity === 'critical') return '[CRITICAL]';
  if (severity === 'warning') return '[WARNING]';
  return '[INFO]';
}

function shouldSend(source) {
  const now = Date.now();
  const last = lastSentAt.get(source) ?? 0;
  if (now - last < COOLDOWN_MS) return false;
  lastSentAt.set(source, now);
  return true;
}

function resolveWebhookUrls() {
  const urls = [];
  const slack = process.env.ALERT_WEBHOOK_SLACK_URL?.trim();
  const discord = process.env.ALERT_WEBHOOK_DISCORD_URL?.trim();
  if (slack) urls.push(slack);
  if (discord) urls.push(discord);
  return urls;
}

function buildBody(url, payload) {
  const label = severityLabel(payload.severity);
  if (url.includes('discord.com/api/webhooks')) {
    const color =
      payload.severity === 'critical'
        ? 0xef4444
        : payload.severity === 'warning'
          ? 0xf59e0b
          : 0x3b82f6;
    return JSON.stringify({
      embeds: [
        {
          title: `${label} ${payload.title}`,
          description: payload.body,
          color,
          footer: { text: payload.source },
        },
      ],
    });
  }
  return JSON.stringify({
    text: `${label} *${payload.title}*\n${payload.body}\n_Source: ${payload.source}_`,
  });
}

export async function sendAlertWebhook(payload) {
  if (!shouldSend(payload.source)) return;

  const urls = resolveWebhookUrls();
  if (urls.length === 0) return;

  await Promise.allSettled(
    urls.map(async (url) => {
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: buildBody(url, payload),
        signal: AbortSignal.timeout(10_000),
      });
      if (!response.ok) {
        throw new Error(`Webhook failed: ${response.status}`);
      }
    }),
  );
}
