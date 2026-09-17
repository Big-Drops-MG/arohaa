import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto'
import { neon } from '@neondatabase/serverless'
import webpush from 'web-push'
import { logger } from '../logger.js'

const WEB_PUSH_QUEUE = 'web_push_queue'
const DUE_POLL_MS = 5_000
const ALGO = 'aes-256-gcm'
const IV_LENGTH = 12

let sql = null

function getSql() {
  if (sql) return sql
  const url =
    process.env.DATABASE_URL?.trim() ||
    process.env.POSTGRES_PRISMA_URL?.trim() ||
    process.env.POSTGRES_URL?.trim()
  if (!url) return null
  sql = neon(url)
  return sql
}

function resolveEncryptionKey() {
  const raw =
    process.env.WEB_PUSH_VAPID_ENCRYPTION_KEY?.trim() ||
    process.env.AUTH_SECRET?.trim() ||
    process.env.NEXTAUTH_SECRET?.trim()
  if (!raw) {
    throw new Error('WEB_PUSH_VAPID_ENCRYPTION_KEY or AUTH_SECRET required')
  }
  return createHash('sha256').update(raw).digest()
}

function decryptVapidPrivateKey(payload) {
  const [ivB64, tagB64, dataB64] = String(payload).split('.')
  if (!ivB64 || !tagB64 || !dataB64) {
    throw new Error('Invalid encrypted VAPID private key payload')
  }
  const key = resolveEncryptionKey()
  const decipher = createDecipheriv(ALGO, key, Buffer.from(ivB64, 'base64url'))
  decipher.setAuthTag(Buffer.from(tagB64, 'base64url'))
  const decrypted = Buffer.concat([
    decipher.update(Buffer.from(dataB64, 'base64url')),
    decipher.final(),
  ])
  return decrypted.toString('utf8')
}

function appendQueryParams(url, params) {
  try {
    const parsed = new URL(url)
    for (const [key, value] of Object.entries(params || {})) {
      if (value == null || value === '') continue
      parsed.searchParams.set(key, value)
    }
    return parsed.toString()
  } catch {
    return url
  }
}

function substituteTemplate(template, vars) {
  return String(template).replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (_, key) => {
    const value = vars[key]
    return value == null ? '' : encodeURIComponent(String(value))
  })
}

function resolveClickUrl({
  click,
  campaignId,
  landingPageId,
  landingPagePublicId,
  subscriptionId,
  origin,
  lastSeenUrl,
  context,
}) {
  const ctx = context && typeof context === 'object' ? context : {}
  const query = ctx.query && typeof ctx.query === 'object' ? ctx.query : {}
  const utm = ctx.utm && typeof ctx.utm === 'object' ? ctx.utm : {}

  let lpHost = ''
  if (origin) {
    try {
      lpHost = new URL(origin).host
    } catch {
      lpHost = String(origin).replace(/^https?:\/\//, '')
    }
  } else if (lastSeenUrl) {
    try {
      lpHost = new URL(lastSeenUrl).host
    } catch {
      lpHost = ''
    }
  }

  const vars = {
    lp_host: lpHost,
    landing_page_id: landingPageId,
    wid: landingPagePublicId || landingPageId,
    campaign_id: campaignId,
    subscription_id: subscriptionId,
    last_url: lastSeenUrl || '',
    session_id: typeof ctx.sessionId === 'string' ? ctx.sessionId : undefined,
    zip: typeof ctx.zip === 'string' ? ctx.zip : query.zip,
    step: ctx.step != null ? String(ctx.step) : query.step != null ? String(query.step) : undefined,
    ...utm,
  }

  const appendUtms = click?.appendUtms || {}
  let resolved = ''

  if (click?.mode === 'fixed') {
    resolved = String(click.fixedUrl || '').trim()
  } else if (click?.mode === 'last_url') {
    resolved = String(lastSeenUrl || click.fixedUrl || '').trim()
    if (!resolved && origin) resolved = origin
  } else {
    resolved = substituteTemplate(String(click?.urlTemplate || '').trim(), vars)
  }

  if (!resolved && origin) resolved = origin
  if (!/^https?:\/\//i.test(resolved) && origin) {
    try {
      resolved = new URL(resolved || '/', origin).toString()
    } catch {
      resolved = origin
    }
  }

  return appendQueryParams(resolved, appendUtms)
}

async function claimDelivery(db, deliveryId) {
  const rows = await db`
    UPDATE web_push_delivery
    SET status = 'sending', "updatedAt" = now()
    WHERE id = ${deliveryId} AND status = 'queued'
    RETURNING id
  `
  return rows[0]?.id ?? null
}

async function loadDeliveryBundle(db, deliveryId) {
  const rows = await db`
    SELECT
      d.id AS "deliveryId",
      d."campaignId",
      d."subscriptionId",
      d."landingPageId",
      d."scheduledFor",
      d."dripStepIndex",
      d."sequenceId",
      d."creativeOverride",
      c.name AS "campaignName",
      c.title,
      c.body,
      c."iconUrl",
      c."badgeUrl",
      c."imageUrl",
      c.tag,
      c."requireInteraction",
      c.click,
      c.limits,
      c.status AS "campaignStatus",
      s.endpoint,
      s.p256dh,
      s.auth,
      s.origin,
      s."lastSeenUrl",
      s.context,
      s.status AS "subscriptionStatus",
      v."publicKey" AS "vapidPublicKey",
      v."privateKeyEncrypted",
      v.subject AS "vapidSubject",
      lp."publicId" AS "landingPagePublicId"
    FROM web_push_delivery d
    INNER JOIN web_push_campaign c ON c.id = d."campaignId"
    INNER JOIN web_push_subscription s ON s.id = d."subscriptionId"
    INNER JOIN landing_page lp ON lp.id = d."landingPageId"
    LEFT JOIN web_push_vapid_key v ON v.id = COALESCE(s."vapidKeyId", (
      SELECT vk.id FROM web_push_vapid_key vk
      WHERE vk."landingPageId" = d."landingPageId"
      LIMIT 1
    ))
    WHERE d.id = ${deliveryId}
    LIMIT 1
  `
  return rows[0] ?? null
}

function parseHhMm(value) {
  const match = /^(\d{1,2}):(\d{2})$/.exec(String(value || '').trim())
  if (!match) return null
  const hours = Number(match[1])
  const minutes = Number(match[2])
  if (
    !Number.isFinite(hours) ||
    !Number.isFinite(minutes) ||
    hours < 0 ||
    hours > 23 ||
    minutes < 0 ||
    minutes > 59
  ) {
    return null
  }
  return { hours, minutes }
}

function getZonedParts(date, timeZone) {
  try {
    const fmt = new Intl.DateTimeFormat('en-US', {
      timeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23',
    })
    const parts = Object.fromEntries(
      fmt.formatToParts(date).map((p) => [p.type, p.value]),
    )
    return {
      year: Number(parts.year),
      month: Number(parts.month),
      day: Number(parts.day),
      hour: Number(parts.hour),
      minute: Number(parts.minute),
    }
  } catch {
    return {
      year: date.getFullYear(),
      month: date.getMonth() + 1,
      day: date.getDate(),
      hour: date.getHours(),
      minute: date.getMinutes(),
    }
  }
}

function zonedLocalToUtc(parts, timeZone) {
  let utc = Date.UTC(
    parts.year,
    parts.month - 1,
    parts.day,
    parts.hour,
    parts.minute,
    0,
    0,
  )
  for (let i = 0; i < 3; i++) {
    const got = getZonedParts(new Date(utc), timeZone)
    const wantedMin =
      parts.year * 525600 +
      parts.month * 43800 +
      parts.day * 1440 +
      parts.hour * 60 +
      parts.minute
    const gotMin =
      got.year * 525600 +
      got.month * 43800 +
      got.day * 1440 +
      got.hour * 60 +
      got.minute
    utc += (wantedMin - gotMin) * 60_000
  }
  return new Date(utc)
}

function isInQuietHours(date, quiet, userTimezone) {
  const start = parseHhMm(quiet?.start)
  const end = parseHhMm(quiet?.end)
  if (!start || !end) return false
  const tz =
    quiet.tz === 'user'
      ? userTimezone?.trim() || 'UTC'
      : quiet.tz?.trim() || 'UTC'
  const parts = getZonedParts(date, tz)
  const nowM = parts.hour * 60 + parts.minute
  const startM = start.hours * 60 + start.minutes
  const endM = end.hours * 60 + end.minutes
  if (startM === endM) return false
  if (startM < endM) return nowM >= startM && nowM < endM
  return nowM >= startM || nowM < endM
}

function adjustForQuietHours(date, quiet, userTimezone) {
  if (!quiet?.start || !quiet?.end) return date
  if (!isInQuietHours(date, quiet, userTimezone)) return date
  const end = parseHhMm(quiet.end)
  const start = parseHhMm(quiet.start)
  if (!end || !start) return date
  const tz =
    quiet.tz === 'user'
      ? userTimezone?.trim() || 'UTC'
      : quiet.tz?.trim() || 'UTC'
  const parts = getZonedParts(date, tz)
  const nowM = parts.hour * 60 + parts.minute
  const startM = start.hours * 60 + start.minutes
  const dayOffset = startM < end.hours * 60 + end.minutes ? 0 : nowM >= startM ? 1 : 0
  const localEndParts = {
    year: parts.year,
    month: parts.month,
    day: parts.day + dayOffset,
    hour: end.hours,
    minute: end.minutes,
  }
  const norm = new Date(
    Date.UTC(
      localEndParts.year,
      localEndParts.month - 1,
      localEndParts.day,
      12,
      0,
      0,
      0,
    ),
  )
  localEndParts.year = norm.getUTCFullYear()
  localEndParts.month = norm.getUTCMonth() + 1
  localEndParts.day = norm.getUTCDate()
  let adjusted = zonedLocalToUtc(localEndParts, tz)
  if (adjusted.getTime() <= date.getTime()) {
    localEndParts.day += 1
    const norm2 = new Date(
      Date.UTC(
        localEndParts.year,
        localEndParts.month - 1,
        localEndParts.day,
        12,
        0,
        0,
        0,
      ),
    )
    adjusted = zonedLocalToUtc(
      {
        year: norm2.getUTCFullYear(),
        month: norm2.getUTCMonth() + 1,
        day: norm2.getUTCDate(),
        hour: end.hours,
        minute: end.minutes,
      },
      tz,
    )
  }
  return adjusted
}

async function requeueDelivery(db, deliveryId, scheduledFor) {
  await db`
    UPDATE web_push_delivery
    SET
      status = 'queued',
      "scheduledFor" = ${scheduledFor},
      "updatedAt" = now(),
      "failureReason" = null
    WHERE id = ${deliveryId}
  `
}

async function countSentLast24h(db, subscriptionId) {
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000)
  const rows = await db`
    SELECT COUNT(*)::int AS total
    FROM web_push_delivery
    WHERE "subscriptionId" = ${subscriptionId}
      AND status = 'sent'
      AND "sentAt" >= ${since}
  `
  return Number(rows[0]?.total ?? 0)
}

async function markSent(db, deliveryId, payloadSnapshot, clickId, targetUrl) {
  await db`
    UPDATE web_push_delivery
    SET
      status = 'sent',
      "sentAt" = now(),
      "updatedAt" = now(),
      "clickId" = ${clickId},
      "targetUrl" = ${targetUrl},
      "payloadSnapshot" = ${JSON.stringify(payloadSnapshot)}::jsonb
    WHERE id = ${deliveryId}
  `
}

async function markFailed(db, deliveryId, code, reason) {
  await db`
    UPDATE web_push_delivery
    SET
      status = 'failed',
      "updatedAt" = now(),
      "failureCode" = ${code},
      "failureReason" = ${reason}
    WHERE id = ${deliveryId}
  `
}

async function deactivateSubscription(db, subscriptionId) {
  await db`
    UPDATE web_push_subscription
    SET status = 'inactive', "updatedAt" = now()
    WHERE id = ${subscriptionId}
  `
}

export async function processWebPushDelivery(deliveryId) {
  const db = getSql()
  if (!db) {
    logger.warn('web push skipped: DATABASE_URL not configured')
    return
  }

  const claimed = await claimDelivery(db, deliveryId)
  if (!claimed) return

  const row = await loadDeliveryBundle(db, deliveryId)
  if (!row) {
    await markFailed(db, deliveryId, null, 'delivery_not_found')
    return
  }

  // Delayed deliveries are DB-polled; Redis may still deliver early — never send before due.
  if (row.scheduledFor) {
    const dueAt = new Date(row.scheduledFor).getTime()
    if (Number.isFinite(dueAt) && dueAt > Date.now() + 1_000) {
      await requeueDelivery(db, deliveryId, new Date(dueAt))
      logger.info({ deliveryId, dueAt }, 'web push not due yet; requeued')
      return
    }
  }

  if (row.campaignStatus === 'paused') {
    await markFailed(db, deliveryId, null, 'campaign_paused')
    return
  }

  if (row.subscriptionStatus !== 'active') {
    await markFailed(db, deliveryId, null, 'subscription_inactive')
    return
  }

  if (!row.vapidPublicKey || !row.privateKeyEncrypted) {
    await markFailed(db, deliveryId, null, 'vapid_missing')
    return
  }

  const limits = row.limits && typeof row.limits === 'object' ? row.limits : null
  const context =
    typeof row.context === 'string' ? JSON.parse(row.context) : row.context
  const userTz = typeof context?.timezone === 'string' ? context.timezone : null

  if (limits?.quietHours && isInQuietHours(new Date(), limits.quietHours, userTz)) {
    const next = adjustForQuietHours(new Date(), limits.quietHours, userTz)
    await requeueDelivery(db, deliveryId, next)
    logger.info({ deliveryId, next }, 'web push deferred for quiet hours')
    return
  }

  if (typeof limits?.maxPerUserPerDay === 'number' && limits.maxPerUserPerDay > 0) {
    const sent = await countSentLast24h(db, row.subscriptionId)
    if (sent >= limits.maxPerUserPerDay) {
      await markFailed(db, deliveryId, null, 'frequency_cap')
      return
    }
  }

  if (typeof limits?.ttlMs === 'number' && limits.ttlMs > 0 && row.scheduledFor) {
    const scheduled = new Date(row.scheduledFor).getTime()
    if (Date.now() - scheduled > limits.ttlMs) {
      await markFailed(db, deliveryId, null, 'ttl_expired')
      return
    }
  }

  const override =
    typeof row.creativeOverride === 'string'
      ? JSON.parse(row.creativeOverride)
      : row.creativeOverride

  const click =
    typeof row.click === 'string' ? JSON.parse(row.click) : row.click || { mode: 'last_url' }
  const clickId = `clk_${randomBytes(8).toString('hex')}`
  const targetUrl = resolveClickUrl({
    click,
    campaignId: row.campaignId,
    landingPageId: row.landingPageId,
    landingPagePublicId: row.landingPagePublicId,
    subscriptionId: row.subscriptionId,
    origin: row.origin,
    lastSeenUrl: row.lastSeenUrl,
    context,
  })

  const clickBase =
    process.env.WEB_PUSH_CLICK_BASE_URL?.trim() ||
    process.env.INGEST_BASE_URL?.trim() ||
    process.env.NEXT_PUBLIC_AROHAA_INGEST_API_BASE?.trim() ||
    (process.env.NODE_ENV !== 'production' ? 'http://127.0.0.1:3001' : '')
  const useMasked = click?.maskedRedirect !== false && Boolean(clickBase)
  const pushUrl = useMasked
    ? `${String(clickBase).replace(/\/$/, '')}/r/${encodeURIComponent(clickId)}`
    : targetUrl

  const payload = {
    title: override?.title || row.title,
    body: override?.body || row.body || undefined,
    icon: override?.iconUrl || row.iconUrl || undefined,
    badge: override?.badgeUrl || row.badgeUrl || undefined,
    image: override?.imageUrl || row.imageUrl || undefined,
    tag: override?.tag || row.tag || undefined,
    url: pushUrl,
    requireInteraction: Boolean(row.requireInteraction),
    data: {
      campaign_id: row.campaignId,
      arohaa_click_id: clickId,
      delivery_id: deliveryId,
      drip_step: row.dripStepIndex ?? undefined,
      sequence_id: row.sequenceId || undefined,
      target_url: targetUrl,
    },
  }

  let privateKey
  try {
    privateKey = decryptVapidPrivateKey(row.privateKeyEncrypted)
  } catch (err) {
    logger.error({ err, deliveryId }, 'vapid decrypt failed')
    await markFailed(db, deliveryId, null, 'vapid_decrypt_failed')
    return
  }

  webpush.setVapidDetails(
    row.vapidSubject || 'mailto:ops@arohaa.net',
    row.vapidPublicKey,
    privateKey,
  )

  try {
    await webpush.sendNotification(
      {
        endpoint: row.endpoint,
        keys: { p256dh: row.p256dh, auth: row.auth },
      },
      JSON.stringify(payload),
      { TTL: 60 * 60 * 24 },
    )
    await markSent(db, deliveryId, payload, clickId, targetUrl)
    logger.info({ deliveryId, campaignId: row.campaignId }, 'web push sent')
  } catch (err) {
    const statusCode = err?.statusCode ?? err?.statusCode ?? null
    const code = typeof statusCode === 'number' ? statusCode : null
    const reason = err?.body || err?.message || 'send_failed'
    logger.error({ err, deliveryId, code }, 'web push send failed')
    await markFailed(db, deliveryId, code, String(reason).slice(0, 500))
    if (code === 410 || code === 404) {
      await deactivateSubscription(db, row.subscriptionId)
    }
  }
}

export async function startWebPushConsumption(redis, { isShuttingDown }) {
  if (!getSql()) {
    logger.error(
      'web push consumer disabled: DATABASE_URL missing — queued deliveries will never send',
    )
    return
  }

  try {
    resolveEncryptionKey()
  } catch (err) {
    logger.error(
      { err },
      'web push consumer disabled: WEB_PUSH_VAPID_ENCRYPTION_KEY or AUTH_SECRET missing',
    )
    return
  }

  logger.info('starting web_push_queue consumption')

  async function pollDue() {
    if (isShuttingDown()) return
    try {
      const db = getSql()
      const due = await db`
        SELECT id FROM web_push_delivery
        WHERE status = 'queued' AND "scheduledFor" <= now()
        ORDER BY "scheduledFor" ASC
        LIMIT 50
      `
      for (const row of due) {
        await processWebPushDelivery(row.id)
      }
    } catch (err) {
      logger.error({ err }, 'web push due poll failed')
    }
  }

  void pollDue()
  const pollTimer = setInterval(() => {
    void pollDue()
  }, DUE_POLL_MS)

  while (!isShuttingDown()) {
    try {
      const result = await redis.blpop(WEB_PUSH_QUEUE, 1)
      if (!result) continue
      const [, payload] = result
      let parsed
      try {
        parsed = JSON.parse(payload)
      } catch {
        logger.warn({ payload }, 'invalid web push queue payload')
        continue
      }
      const deliveryId = parsed?.deliveryId
      if (!deliveryId) continue
      await processWebPushDelivery(deliveryId)
    } catch (err) {
      if (isShuttingDown()) break
      logger.error({ err }, 'web push consumer error')
      await new Promise((r) => setTimeout(r, 1000))
    }
  }

  clearInterval(pollTimer)
}

