import Fastify from 'fastify'
import { describe, expect, it } from 'vitest'
import { ALLOWED_INGEST_EVENT_NAMES } from '../lib/allowed-event-names.js'

const eventBodyProperties = {
  event_id: {
    type: 'string',
    minLength: 8,
    maxLength: 64,
    pattern:
      '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}$',
  },
  ev: {
    type: 'string',
    maxLength: 50,
    enum: [...ALLOWED_INGEST_EVENT_NAMES],
  },
  wid: { type: 'string', format: 'uuid' },
  sid: { type: 'string', minLength: 8, maxLength: 64 },
  uid: { type: 'string', minLength: 8, maxLength: 64 },
} as const

describe('ingest schema additionalProperties', () => {
  it('rejects unknown top-level fields when removeAdditional is false', async () => {
    const app = Fastify({
      ajv: {
        customOptions: {
          removeAdditional: false,
          coerceTypes: true,
          useDefaults: true,
        },
      },
    })
    app.post(
      '/v1/ingest',
      {
        schema: {
          body: {
            type: 'object',
            required: ['sid', 'uid', 'event_id', 'ev', 'wid'],
            additionalProperties: false,
            properties: eventBodyProperties,
          },
        },
      },
      async () => ({ ok: true }),
    )
    await app.ready()

    const res = await app.inject({
      method: 'POST',
      url: '/v1/ingest',
      payload: {
        event_id: '11111111-1111-4111-8111-111111111111',
        ev: 'page_view',
        wid: '22222222-2222-4222-8222-222222222222',
        sid: 'session01',
        uid: 'visitor01',
        unknown_field: 'nope',
      },
    })

    expect(res.statusCode).toBe(400)
    await app.close()
  })
})
