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

  it('rate-limits repeated alerts from the same source', async () => {
    process.env.ALERT_WEBHOOK_SLACK_URL = 'https://hooks.slack.com/services/test'
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(null, { status: 200 }),
    )

    const payload = {
      title: 'Repeat',
      body: 'same source',
      severity: 'warning' as const,
      source: 'test.cooldown',
    }

    await sendAlertWebhook(payload)
    await sendAlertWebhook(payload)

    expect(fetchMock).toHaveBeenCalledOnce()
  })
})
