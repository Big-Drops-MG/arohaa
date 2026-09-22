import {
  and,
  count,
  db,
  eq,
  gte,
  hashPushEndpoint,
  inArray,
  landingPages,
  sql,
  webPushCampaigns,
  webPushDeliveries,
  webPushSiteConfigs,
  webPushSubscriptions,
  webPushVapidKeys,
  webPushClientEvents,
  adjustForQuietHours,
  resolveQuietHoursFromLimits,
  decryptWebhookSecret,
  type WebPushCampaignClick,
  type WebPushCampaignLimits,
  type WebPushCampaignTrigger,
  type WebPushDeliveryCreativeOverride,
  type WebPushDripStep,
  type WebPushSubscriptionContext,
} from "@workspace/database"

export const WEB_PUSH_QUEUE = "web_push_queue"

export type PushSubscriptionKeys = {
  endpoint: string
  expirationTime?: number | null
  keys: { p256dh: string; auth: string }
}

export type SubscribeContext = {
  landing_page_id?: string
  wid?: string
  origin?: string
  page_url?: string
  page_path?: string
  query?: Record<string, string>
  utm?: Record<string, string>
  user_agent?: string
  timezone?: string
  session_id?: string
  zip?: string
  step?: number | string
}

async function resolveLandingPageId(input: {
  landingPageId?: string | null
  wid?: string | null
  origin?: string | null
}): Promise<{ id: string; publicId: string; origin: string } | null> {
  const lpId = input.landingPageId?.trim()
  const wid = input.wid?.trim()
  if (lpId || wid) {
    const found = await db
      .select({
        id: landingPages.id,
        publicId: landingPages.publicId,
        origin: landingPages.origin,
      })
      .from(landingPages)
      .where(
        and(
          sql`${landingPages.deletedAt} IS NULL`,
          lpId
            ? eq(landingPages.id, lpId)
            : eq(landingPages.publicId, wid!)
        )
      )
      .limit(1)

    if (found[0]) return found[0]
  }

  const origin = input.origin?.trim()
  if (!origin) return null
  let hostname = ""
  try {
    hostname = new URL(origin).hostname
  } catch {
    return null
  }

  const byOrigin = await db
    .select({
      id: landingPages.id,
      publicId: landingPages.publicId,
      origin: landingPages.origin,
    })
    .from(landingPages)
    .where(
      and(
        sql`${landingPages.deletedAt} IS NULL`,
        eq(landingPages.hostname, hostname)
      )
    )
    .limit(1)

  return byOrigin[0] ?? null
}

function buildContext(
  context?: SubscribeContext | null
): WebPushSubscriptionContext {
  return {
    pageUrl: context?.page_url ?? null,
    pagePath: context?.page_path ?? null,
    query: context?.query ?? null,
    utm: context?.utm ?? null,
    userAgent: context?.user_agent ?? null,
    timezone: context?.timezone ?? null,
    sessionId: context?.session_id ?? null,
    zip: context?.zip ?? null,
    step: context?.step ?? null,
  }
}

export async function upsertWebPushSubscription(input: {
  action: "subscribe" | "unsubscribe"
  subscription: PushSubscriptionKeys
  context?: SubscribeContext | null
}): Promise<{ ok: true; subscriptionId: string | null } | { ok: false; error: string }> {
  const endpoint = input.subscription?.endpoint?.trim()
  const p256dh = input.subscription?.keys?.p256dh?.trim()
  const auth = input.subscription?.keys?.auth?.trim()
  if (!endpoint) return { ok: false, error: "subscription.endpoint required" }

  if (input.action === "unsubscribe") {
    await db
      .update(webPushSubscriptions)
      .set({
        status: "inactive",
        updatedAt: new Date(),
      })
      .where(eq(webPushSubscriptions.endpoint, endpoint))
    return { ok: true, subscriptionId: null }
  }

  if (!p256dh || !auth) {
    return { ok: false, error: "subscription.keys required" }
  }

  const landing = await resolveLandingPageId({
    landingPageId: input.context?.landing_page_id,
    wid: input.context?.wid,
    origin: input.context?.origin,
  })
  if (!landing) {
    return { ok: false, error: "landing page not found" }
  }

  const vapid = await db
    .select({ id: webPushVapidKeys.id })
    .from(webPushVapidKeys)
    .where(eq(webPushVapidKeys.landingPageId, landing.id))
    .limit(1)

  const now = new Date()
  const context = buildContext(input.context)
  const endpointHash = hashPushEndpoint(endpoint)
  const expirationTime =
    typeof input.subscription.expirationTime === "number"
      ? new Date(input.subscription.expirationTime)
      : null

  const existing = await db
    .select({ id: webPushSubscriptions.id })
    .from(webPushSubscriptions)
    .where(eq(webPushSubscriptions.endpoint, endpoint))
    .limit(1)

  if (existing[0]) {
    await db
      .update(webPushSubscriptions)
      .set({
        landingPageId: landing.id,
        vapidKeyId: vapid[0]?.id ?? null,
        p256dh,
        auth,
        expirationTime,
        origin: input.context?.origin ?? landing.origin,
        lastSeenUrl: input.context?.page_url ?? null,
        context,
        status: "active",
        updatedAt: now,
        lastEventAt: now,
      })
      .where(eq(webPushSubscriptions.id, existing[0].id))
    return { ok: true, subscriptionId: existing[0].id }
  }

  const id = crypto.randomUUID()
  await db.insert(webPushSubscriptions).values({
    id,
    landingPageId: landing.id,
    vapidKeyId: vapid[0]?.id ?? null,
    endpoint,
    endpointHash,
    p256dh,
    auth,
    expirationTime,
    origin: input.context?.origin ?? landing.origin,
    lastSeenUrl: input.context?.page_url ?? null,
    context,
    status: "active",
    createdAt: now,
    updatedAt: now,
    lastEventAt: now,
  })

  return { ok: true, subscriptionId: id }
}

async function cancelPendingDeliveries(input: {
  subscriptionId: string
  landingPageId: string
  events: string[]
}): Promise<number> {
  const campaigns = await db
    .select({
      id: webPushCampaigns.id,
      trigger: webPushCampaigns.trigger,
    })
    .from(webPushCampaigns)
    .where(
      and(
        eq(webPushCampaigns.status, "active"),
        eq(webPushCampaigns.landingPageId, input.landingPageId)
      )
    )

  const cancelCampaignIds = campaigns
    .filter((c) => {
      const cancelOn = c.trigger?.cancelOn ?? []
      return input.events.some((ev) => cancelOn.includes(ev))
    })
    .map((c) => c.id)

  if (cancelCampaignIds.length === 0) return 0

  await db
    .update(webPushDeliveries)
    .set({
      status: "cancelled",
      updatedAt: new Date(),
      failureReason: `cancelled_by_event:${input.events.join(",")}`,
    })
    .where(
      and(
        eq(webPushDeliveries.subscriptionId, input.subscriptionId),
        eq(webPushDeliveries.status, "queued"),
        inArray(webPushDeliveries.campaignId, cancelCampaignIds)
      )
    )

  return cancelCampaignIds.length
}

async function countSentLast24h(subscriptionId: string): Promise<number> {
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000)
  const rows = await db
    .select({ total: count() })
    .from(webPushDeliveries)
    .where(
      and(
        eq(webPushDeliveries.subscriptionId, subscriptionId),
        inArray(webPushDeliveries.status, ["sent", "clicked"]),
        gte(webPushDeliveries.sentAt, since)
      )
    )
  return Number(rows[0]?.total ?? 0)
}

export async function getSentCountLast24h(
  subscriptionId: string
): Promise<number> {
  return countSentLast24h(subscriptionId)
}

async function insertDelivery(input: {
  campaignId: string
  subscriptionId: string
  landingPageId: string
  scheduledFor: Date
  dripStepIndex?: number | null
  sequenceId?: string | null
  creativeOverride?: WebPushDeliveryCreativeOverride | null
  enqueue: (deliveryId: string) => Promise<void>
}): Promise<string> {
  const deliveryId = crypto.randomUUID()
  const now = new Date()
  await db.insert(webPushDeliveries).values({
    id: deliveryId,
    campaignId: input.campaignId,
    subscriptionId: input.subscriptionId,
    landingPageId: input.landingPageId,
    status: "queued",
    scheduledFor: input.scheduledFor,
    dripStepIndex: input.dripStepIndex ?? null,
    sequenceId: input.sequenceId ?? null,
    creativeOverride: input.creativeOverride ?? null,
    createdAt: now,
    updatedAt: now,
  })
  if (input.scheduledFor.getTime() <= Date.now() + 2_000) {
    await input.enqueue(deliveryId)
  }
  return deliveryId
}

function normalizeDripSteps(
  trigger: WebPushCampaignTrigger
): Array<{ delayMs: number; override: WebPushDeliveryCreativeOverride | null }> {
  if (trigger.type === "drip") {
    const steps = (trigger.steps ?? []).filter(
      (s) => s && Number.isFinite(Number(s.delayMs))
    ) as WebPushDripStep[]
    return steps
      .map((s) => ({
        delayMs: Math.max(0, Number(s.delayMs) || 0),
        override: {
          title: s.title ?? null,
          body: s.body ?? null,
          tag: s.tag ?? null,
          iconUrl: s.iconUrl ?? null,
          badgeUrl: s.badgeUrl ?? null,
          imageUrl: s.imageUrl ?? null,
        },
      }))
      .sort((a, b) => a.delayMs - b.delayMs)
  }
  if (trigger.type === "delay_after_event") {
    return [
      {
        delayMs: Math.max(0, Number(trigger.delayMs ?? 0) || 0),
        override: null,
      },
    ]
  }
  return []
}

async function scheduleMatchingCampaigns(input: {
  landingPageId: string
  subscriptionId: string
  event: string
  occurredAt: Date
  userTimezone?: string | null
  enqueue: (deliveryId: string) => Promise<void>
}): Promise<string[]> {
  const campaigns = await db
    .select()
    .from(webPushCampaigns)
    .where(
      and(
        eq(webPushCampaigns.landingPageId, input.landingPageId),
        eq(webPushCampaigns.status, "active")
      )
    )

  const createdIds: string[] = []
  for (const campaign of campaigns) {
    const trigger = campaign.trigger as WebPushCampaignTrigger
    if (trigger.type !== "delay_after_event" && trigger.type !== "drip") {
      continue
    }
    if ((trigger.event ?? "").trim() !== input.event) continue

    const pending = await db
      .select({ id: webPushDeliveries.id })
      .from(webPushDeliveries)
      .where(
        and(
          eq(webPushDeliveries.campaignId, campaign.id),
          eq(webPushDeliveries.subscriptionId, input.subscriptionId),
          inArray(webPushDeliveries.status, ["queued", "sending"])
        )
      )
      .limit(1)
    if (pending[0]) continue

    const limits = campaign.limits as WebPushCampaignLimits | null
    const quiet = resolveQuietHoursFromLimits(limits)
    const ttlMs = limits?.ttlMs
    const maxPerDay = limits?.maxPerUserPerDay
    let sentToday = await countSentLast24h(input.subscriptionId)
    const steps = normalizeDripSteps(trigger)
    if (steps.length === 0) continue

    const sequenceId =
      trigger.type === "drip" ? crypto.randomUUID() : null

    for (let i = 0; i < steps.length; i++) {
      const step = steps[i]!
      if (typeof maxPerDay === "number" && maxPerDay > 0) {
        if (sentToday >= maxPerDay) break
      }

      let scheduledFor = new Date(input.occurredAt.getTime() + step.delayMs)
      scheduledFor = adjustForQuietHours(
        scheduledFor,
        quiet,
        input.userTimezone
      )

      if (typeof ttlMs === "number" && ttlMs > 0) {
        const expiresAt = new Date(input.occurredAt.getTime() + ttlMs)
        if (scheduledFor > expiresAt) continue
      }

      const hasOverride =
        step.override &&
        Object.values(step.override).some((v) => v != null && v !== "")

      const deliveryId = await insertDelivery({
        campaignId: campaign.id,
        subscriptionId: input.subscriptionId,
        landingPageId: input.landingPageId,
        scheduledFor,
        dripStepIndex: trigger.type === "drip" ? i : null,
        sequenceId,
        creativeOverride: hasOverride ? step.override : null,
        enqueue: input.enqueue,
      })
      createdIds.push(deliveryId)
      // Reserve a slot toward the cap for planned sends in this batch
      if (typeof maxPerDay === "number" && maxPerDay > 0) {
        sentToday += 1
      }
    }
  }

  return createdIds
}

export async function ingestWebPushEvent(input: {
  event: string
  subscriptionEndpoint: string
  landingPageId?: string | null
  wid?: string | null
  occurredAt?: string | null
  context?: SubscribeContext | null
  deliveryId?: string | null
  clickId?: string | null
  enqueue: (deliveryId: string) => Promise<void>
}): Promise<{ ok: true; scheduled: string[] } | { ok: false; error: string }> {
  const event = input.event?.trim()
  if (!event) return { ok: false, error: "event required" }

  if (
    event === "push_displayed" ||
    event === "push_dismissed" ||
    event.startsWith("push_permission_")
  ) {
    const recorded = await recordWebPushClientSignal({
      event,
      deliveryId: input.deliveryId,
      clickId: input.clickId,
      subscriptionEndpoint: input.subscriptionEndpoint,
      landingPageId: input.landingPageId,
      wid: input.wid,
      context: input.context,
      occurredAt: input.occurredAt,
    })
    if (!recorded.ok) return recorded
    return { ok: true, scheduled: [] }
  }

  const endpoint = input.subscriptionEndpoint?.trim()
  if (!endpoint) return { ok: false, error: "subscription_endpoint required" }

  const subs = await db
    .select()
    .from(webPushSubscriptions)
    .where(eq(webPushSubscriptions.endpoint, endpoint))
    .limit(1)

  const sub = subs[0]
  if (!sub) {
    return { ok: false, error: "subscription not found" }
  }

  const landing = await resolveLandingPageId({
    landingPageId: input.landingPageId ?? sub.landingPageId,
    wid: input.wid,
    origin: input.context?.origin ?? sub.origin,
  })

  const now = input.occurredAt ? new Date(input.occurredAt) : new Date()
  const mergedContext: WebPushSubscriptionContext = {
    ...(sub.context ?? {}),
    ...buildContext(input.context),
  }

  await db
    .update(webPushSubscriptions)
    .set({
      lastSeenUrl: input.context?.page_url ?? sub.lastSeenUrl,
      context: mergedContext,
      updatedAt: now,
      lastEventAt: now,
      status: event === "unsubscribe" ? "inactive" : sub.status,
    })
    .where(eq(webPushSubscriptions.id, sub.id))

  await cancelPendingDeliveries({
    subscriptionId: sub.id,
    landingPageId: landing?.id ?? sub.landingPageId,
    events: [event],
  })

  if (event === "unsubscribe" || sub.status !== "active") {
    return { ok: true, scheduled: [] }
  }

  const scheduled = await scheduleMatchingCampaigns({
    landingPageId: landing?.id ?? sub.landingPageId,
    subscriptionId: sub.id,
    event,
    occurredAt: now,
    userTimezone:
      typeof mergedContext.timezone === "string"
        ? mergedContext.timezone
        : null,
    enqueue: input.enqueue,
  })

  return { ok: true, scheduled }
}

export async function recordWebPushClientSignal(input: {
  event: string
  deliveryId?: string | null
  clickId?: string | null
  subscriptionEndpoint?: string | null
  landingPageId?: string | null
  wid?: string | null
  context?: SubscribeContext | null
  occurredAt?: string | null
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const now = input.occurredAt ? new Date(input.occurredAt) : new Date()
  const clickId = input.clickId?.trim() || null
  const deliveryId = input.deliveryId?.trim() || null

  let delivery:
    | {
        id: string
        landingPageId: string
        subscriptionId: string
        displayedAt: Date | null
        dismissedAt: Date | null
        clickedAt: Date | null
      }
    | undefined

  if (deliveryId) {
    const rows = await db
      .select({
        id: webPushDeliveries.id,
        landingPageId: webPushDeliveries.landingPageId,
        subscriptionId: webPushDeliveries.subscriptionId,
        displayedAt: webPushDeliveries.displayedAt,
        dismissedAt: webPushDeliveries.dismissedAt,
        clickedAt: webPushDeliveries.clickedAt,
      })
      .from(webPushDeliveries)
      .where(eq(webPushDeliveries.id, deliveryId))
      .limit(1)
    delivery = rows[0]
  } else if (clickId) {
    const rows = await db
      .select({
        id: webPushDeliveries.id,
        landingPageId: webPushDeliveries.landingPageId,
        subscriptionId: webPushDeliveries.subscriptionId,
        displayedAt: webPushDeliveries.displayedAt,
        dismissedAt: webPushDeliveries.dismissedAt,
        clickedAt: webPushDeliveries.clickedAt,
      })
      .from(webPushDeliveries)
      .where(eq(webPushDeliveries.clickId, clickId))
      .limit(1)
    delivery = rows[0]
  }

  let landingPageId = delivery?.landingPageId ?? null
  let subscriptionId = delivery?.subscriptionId ?? null

  if (!landingPageId) {
    const landing = await resolveLandingPageId({
      landingPageId: input.landingPageId,
      wid: input.wid,
      origin: input.context?.origin,
    })
    landingPageId = landing?.id ?? null
  }

  if (!subscriptionId && input.subscriptionEndpoint?.trim()) {
    const subs = await db
      .select({
        id: webPushSubscriptions.id,
        landingPageId: webPushSubscriptions.landingPageId,
      })
      .from(webPushSubscriptions)
      .where(
        eq(webPushSubscriptions.endpoint, input.subscriptionEndpoint.trim())
      )
      .limit(1)
    if (subs[0]) {
      subscriptionId = subs[0].id
      landingPageId = landingPageId ?? subs[0].landingPageId
    }
  }

  if (!landingPageId) {
    return { ok: false, error: "landing page not found" }
  }

  if (delivery && input.event === "push_displayed" && !delivery.displayedAt) {
    await db
      .update(webPushDeliveries)
      .set({ displayedAt: now, updatedAt: now })
      .where(eq(webPushDeliveries.id, delivery.id))
  }

  if (
    delivery &&
    input.event === "push_dismissed" &&
    !delivery.dismissedAt &&
    !delivery.clickedAt
  ) {
    await db
      .update(webPushDeliveries)
      .set({ dismissedAt: now, updatedAt: now })
      .where(eq(webPushDeliveries.id, delivery.id))
  }

  await db.insert(webPushClientEvents).values({
    id: crypto.randomUUID(),
    landingPageId,
    subscriptionId,
    deliveryId: delivery?.id ?? null,
    type: input.event,
    meta: {
      clickId,
      wid: input.wid ?? null,
    },
    createdAt: now,
  })

  return { ok: true }
}

export async function createManualDeliveries(input: {
  campaignId: string
  landingPageId: string
  subscriptionIds?: string[] | null
  enqueue: (deliveryId: string) => Promise<void>
}): Promise<{ created: number; deliveryIds: string[] }> {
  const campaign = await db
    .select()
    .from(webPushCampaigns)
    .where(
      and(
        eq(webPushCampaigns.id, input.campaignId),
        eq(webPushCampaigns.landingPageId, input.landingPageId)
      )
    )
    .limit(1)

  if (!campaign[0]) return { created: 0, deliveryIds: [] }

  const limits = campaign[0].limits as WebPushCampaignLimits | null
  const quiet = resolveQuietHoursFromLimits(limits)
  const maxPerDay = limits?.maxPerUserPerDay

  const subsQuery = db
    .select({
      id: webPushSubscriptions.id,
      context: webPushSubscriptions.context,
    })
    .from(webPushSubscriptions)
    .where(
      and(
        eq(webPushSubscriptions.landingPageId, input.landingPageId),
        eq(webPushSubscriptions.status, "active"),
        ...(input.subscriptionIds?.length
          ? [inArray(webPushSubscriptions.id, input.subscriptionIds)]
          : [])
      )
    )

  const subs = await subsQuery

  const now = new Date()
  const deliveryIds: string[] = []
  for (const sub of subs) {
    if (typeof maxPerDay === "number" && maxPerDay > 0) {
      const sent = await countSentLast24h(sub.id)
      if (sent >= maxPerDay) continue
    }
    const tz =
      sub.context && typeof sub.context.timezone === "string"
        ? sub.context.timezone
        : null
    const scheduledFor = adjustForQuietHours(now, quiet, tz)
    const deliveryId = await insertDelivery({
      campaignId: campaign[0].id,
      subscriptionId: sub.id,
      landingPageId: input.landingPageId,
      scheduledFor,
      enqueue: input.enqueue,
    })
    deliveryIds.push(deliveryId)
  }

  return { created: deliveryIds.length, deliveryIds }
}

export async function getWebhookSecretForLanding(
  landingPageId: string
): Promise<string | null> {
  const rows = await db
    .select({
      webhookSecretEncrypted: webPushSiteConfigs.webhookSecretEncrypted,
    })
    .from(webPushSiteConfigs)
    .where(eq(webPushSiteConfigs.landingPageId, landingPageId))
    .limit(1)
  if (!rows[0]) return null
  try {
    return decryptWebhookSecret(rows[0].webhookSecretEncrypted)
  } catch {
    return null
  }
}

export async function resolveLandingPageIdForWebhook(input: {
  landingPageId?: string | null
  wid?: string | null
  origin?: string | null
}): Promise<{ id: string; publicId: string; origin: string } | null> {
  return resolveLandingPageId(input)
}

export type CampaignWriteInput = {
  name: string
  title: string
  body?: string | null
  iconUrl?: string | null
  badgeUrl?: string | null
  imageUrl?: string | null
  tag?: string | null
  requireInteraction?: boolean
  click: WebPushCampaignClick
  trigger: WebPushCampaignTrigger
  limits?: WebPushCampaignLimits | null
  status?: "draft" | "active" | "paused"
}
