import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  resetAlertWebhookCooldownForTests,
  sendAlertWebhook,
} from './alert-webhook.js'

describe('alert webhook', () => {
  afterEach(() => {
    resetAlertWebhookCooldownForTests()
    vi.restoreAllMocks()
    delete process.env.ALERT_WEBHOOK_SLACK_URL
    delete process.env.ALERT_WEBHOOK_DISCORD_URL
  })

  it('does nothing when webhook URLs are not configured', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch')
    await sendAlertWebhook({
      title: 'Test',
      body: 'Body',
      severity: 'info',
      source: 'test.no-config',
    })
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('posts to configured slack webhook', async () => {
    process.env.ALERT_WEBHOOK_SLACK_URL = 'https://hooks.slack.com/services/test'
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(null, { status: 200 }),
    )

    await sendAlertWebhook({
      title: 'Queue depth high',
      body: 'analytics_queue=9000',
      severity: 'warning',
      source: 'test.slack',
    })

    expect(fetchMock).toHaveBeenCalledOnce()
    const [, init] = fetchMock.mock.calls[0]!
    expect(init?.method).toBe('POST')
  })

  it('posts discord embeds for discordapp.com webhooks', async () => {
    process.env.ALERT_WEBHOOK_DISCORD_URL =
      'https://discordapp.com/api/webhooks/1/token'
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(null, { status: 204 }),
    )

    await sendAlertWebhook({
      title: 'Queue depth high',
      body: 'analytics_queue=9000',
      severity: 'warning',
      source: 'test.discordapp',
    })

    expect(fetchMock).toHaveBeenCalledOnce()
    const [, init] = fetchMock.mock.calls[0]!
    const body = JSON.parse(String(init?.body ?? '{}')) as {
      embeds?: unknown[]
      text?: string
    }
    expect(body.embeds).toHaveLength(1)
    expect(body.text).toBeUndefined()
  })
})
