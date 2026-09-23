import { Readable } from 'node:stream'
import type { FastifyInstance, FastifyRequest } from 'fastify'
import { verifyInternalApiRequest } from '../lib/internal-api-secret.js'
import {
  upsertWebPushSubscription,
  ingestWebPushEvent,
  WEB_PUSH_QUEUE,
  resolveLandingPageIdForWebhook,
  getWebhookSecretForLanding,
  verifyWebPushSignature,
  resolveClickRedirect,
  type SubscribeContext,
} from '@workspace/database'
import { redis } from '../services/redis.service.js'

const WEB_PUSH_RATE_LIMIT = {
  rateLimit: {
    max: 120,
    timeWindow: '1 minute',
  },
} as const

type RequestWithRawBody = FastifyRequest & { rawBody?: string }

type ResolvedLanding = { id: string; publicId: string; origin: string }

async function enqueueDelivery(deliveryId: string): Promise<void> {
  await redis.lpush(
    WEB_PUSH_QUEUE,
    JSON.stringify({ deliveryId, enqueuedAt: Date.now() }),
  )
}

type SubscriptionBody = {
  action?: string
  subscription?: {
    endpoint?: string
    expirationTime?: number | null
    keys?: { p256dh?: string; auth?: string }
  }
  context?: SubscribeContext
}

type EventBody = {
  event?: string
  subscription_endpoint?: string
  landing_page_id?: string
  wid?: string
  occurred_at?: string
  delivery_id?: string
  arohaa_click_id?: string
  context?: SubscribeContext
}

async function assertWebhookAuth(
  request: RequestWithRawBody,
  identity: {
    landingPageId?: string | null
    wid?: string | null
    origin?: string | null
  },
): Promise<
  | { ok: true; landing: ResolvedLanding }
  | { ok: false; status: number; error: string }
> {
  const landing = await resolveLandingPageIdForWebhook(identity)
  if (!landing) {
    return {
      ok: false,
      status: 401,
      error: 'Unable to resolve landing page for webhook auth',
    }
  }

  const secret = await getWebhookSecretForLanding(landing.id)
  if (!secret) {
    return {
      ok: false,
      status: 401,
      error: 'Webhook secret is not configured for this landing page',
    }
  }

  const signature = String(
    request.headers['x-arohaa-web-push-signature'] ?? '',
  )
  const rawBody = request.rawBody ?? ''
  if (
    rawBody &&
    verifyWebPushSignature({
      secret,
      rawBody,
      signatureHeader: signature,
    })
  ) {
    return { ok: true, landing }
  }

  return {
    ok: false,
    status: 401,
    error:
      'Invalid or missing webhook signature. Send x-arohaa-web-push-signature: sha256=<hmac>.',
  }
}

export async function webPushRoutes(server: FastifyInstance) {
  server.addHook('preParsing', async (request, _reply, payload) => {
    if (!request.url.startsWith('/v1/web-push/')) return payload

    const chunks: Buffer[] = []
    for await (const chunk of payload) {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk))
    }
    const raw = Buffer.concat(chunks)
    ;(request as RequestWithRawBody).rawBody = raw.toString('utf8')
    return Readable.from(raw)
  })

  async function handleClickRedirect(
    request: FastifyRequest<{ Params: { token: string } }>,
    reply: import('fastify').FastifyReply,
  ) {
    const result = await resolveClickRedirect(request.params.token ?? '')
    if (!result.ok) {
      return reply.status(result.status).send({ error: result.error })
    }
    return reply.redirect(result.url, 302)
  }

  server.get<{ Params: { token: string } }>(
    '/r/:token',
    async (request, reply) => handleClickRedirect(request, reply),
  )

  server.get<{ Params: { token: string } }>(
    '/v1/web-push/r/:token',
    async (request, reply) => handleClickRedirect(request, reply),
  )

  server.post<{ Body: SubscriptionBody }>(
    '/v1/web-push/subscriptions',
    {
      config: WEB_PUSH_RATE_LIMIT,
    },
    async (request, reply) => {
      const body = request.body ?? {}
      const auth = await assertWebhookAuth(request as RequestWithRawBody, {
        landingPageId: body.context?.landing_page_id,
        wid: body.context?.wid,
        origin: body.context?.origin,
      })
      if (!auth.ok) {
        return reply.status(auth.status).send({ error: auth.error })
      }

      const action =
        body.action === 'unsubscribe' ? 'unsubscribe' : 'subscribe'
      const endpoint = body.subscription?.endpoint?.trim()
      const p256dh = body.subscription?.keys?.p256dh?.trim()
      const authKey = body.subscription?.keys?.auth?.trim()

      if (!endpoint) {
        return reply.status(400).send({ error: 'subscription.endpoint required' })
      }

      if (action === 'subscribe' && (!p256dh || !authKey)) {
        return reply.status(400).send({ error: 'subscription.keys required' })
      }

      const result = await upsertWebPushSubscription({
        action,
        subscription: {
          endpoint,
          expirationTime: body.subscription?.expirationTime ?? null,
          keys: { p256dh: p256dh ?? '', auth: authKey ?? '' },
        },
        context: body.context ?? null,
        landingPageId: auth.landing.id,
      })

      if (!result.ok) {
        return reply.status(400).send({ error: result.error })
      }

      return reply.status(200).send({
        ok: true,
        action,
        subscription_id: result.subscriptionId,
      })
    },
  )

  server.post<{ Body: EventBody }>(
    '/v1/web-push/events',
    {
      config: WEB_PUSH_RATE_LIMIT,
    },
    async (request, reply) => {
      const body = request.body ?? {}
      const auth = await assertWebhookAuth(request as RequestWithRawBody, {
        landingPageId: body.landing_page_id ?? body.context?.landing_page_id,
        wid: body.wid ?? body.context?.wid,
        origin: body.context?.origin,
      })
      if (!auth.ok) {
        return reply.status(auth.status).send({ error: auth.error })
      }

      const result = await ingestWebPushEvent({
        event: body.event ?? '',
        subscriptionEndpoint: body.subscription_endpoint ?? '',
        landingPageId: auth.landing.id,
        wid: body.wid,
        occurredAt: body.occurred_at,
        context: body.context ?? null,
        deliveryId: body.delivery_id,
        clickId: body.arohaa_click_id,
        enqueue: enqueueDelivery,
      })

      if (!result.ok) {
        return reply.status(400).send({ error: result.error })
      }

      return reply.status(200).send({
        ok: true,
        scheduled: result.scheduled,
      })
    },
  )

  server.post<{ Body: { deliveryId?: string } }>(
    '/v1/web-push/internal/enqueue',
    async (request, reply) => {
      if (!verifyInternalApiRequest(request.headers['x-arohaa-internal'])) {
        return reply.status(401).send({ error: 'unauthorized' })
      }

      const deliveryId = request.body?.deliveryId?.trim()
      if (!deliveryId) {
        return reply.status(400).send({ error: 'deliveryId required' })
      }
      await enqueueDelivery(deliveryId)
      return reply.status(200).send({ ok: true })
    },
  )
}
