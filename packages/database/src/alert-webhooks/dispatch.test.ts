import { describe, expect, it } from 'vitest'
import {
  buildWebhookBody,
  detectWebhookProvider,
  isAllowedWebhookUrl,
} from './dispatch.js'

describe('alert webhook dispatch', () => {
  it('detects slack and discord providers', () => {
    expect(
      detectWebhookProvider('https://hooks.slack.com/services/T/B/x'),
    ).toBe('slack')
    expect(
      detectWebhookProvider('https://discord.com/api/webhooks/1/2'),
    ).toBe('discord')
  })

  it('allows only https slack/discord webhook URLs', () => {
    expect(isAllowedWebhookUrl('https://hooks.slack.com/services/test')).toBe(
      true,
    )
    expect(isAllowedWebhookUrl('http://hooks.slack.com/services/test')).toBe(
      false,
    )
    expect(isAllowedWebhookUrl('https://example.com/hook')).toBe(false)
    expect(isAllowedWebhookUrl('https://evilslack.com/services/test')).toBe(
      false,
    )
    expect(
      isAllowedWebhookUrl('https://hooks.slack.com:1234/services/test'),
    ).toBe(false)
    expect(
      isAllowedWebhookUrl('https://discord.com/api/webhooks/1/2'),
    ).toBe(true)
    expect(isAllowedWebhookUrl('https://evildiscord.com/api/webhooks/1/2')).toBe(
      false,
    )
  })

  it('builds slack-compatible JSON bodies', () => {
    const body = buildWebhookBody('https://hooks.slack.com/services/test', {
      title: 'Traffic spike',
      body: 'Sessions up 40%',
      severity: 'warning',
      source: 'analytics',
    })
    expect(body).toContain('Traffic spike')
    expect(body).toContain('[WARNING]')
  })
})
