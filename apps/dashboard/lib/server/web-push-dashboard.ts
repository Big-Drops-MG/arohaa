import {
  and,
  count,
  createManualDeliveries,
  db,
  decryptVapidPrivateKey,
  encryptVapidPrivateKey,
  encryptWebhookSecret,
  eq,
  desc,
  generateWebhookSecret,
  inArray,
  webPushCampaigns,
  webPushDeliveries,
  webPushSiteConfigs,
  webPushSubscriptions,
  webPushVapidKeys,
  type CampaignWriteInput,
} from "@workspace/database"
import webpush from "web-push"
import { getActiveLandingPageForActor } from "@/lib/server/landing-pages-store"
import {
  resolveIngestApiBase,
  resolveInternalApiSecret,
} from "@/lib/server/analytics-env"
import { isWebPushMediaUploadConfigured } from "@/lib/server/web-push-media"
import type {
  NotificationCenterCampaign,
  NotificationCenterDashboardData,
  NotificationCenterDelivery,
  NotificationCenterStats,
  NotificationCenterSubscription,
  NotificationCenterVapid,
  NotificationCenterWebhook,
} from "@/features/notification-center/model/notification-center"

function isHttpsUrl(value: string | null | undefined): boolean {
  if (!value) return true
  try {
    const url = new URL(value)
    return url.protocol === "https:"
  } catch {
    return false
  }
}

async function enqueueDelivery(deliveryId: string): Promise<void> {
  const base = resolveIngestApiBase()
  if (!base) return
  const secret = resolveInternalApiSecret()
  try {
    await fetch(`${base}/v1/web-push/internal/enqueue`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        ...(secret ? { "x-arohaa-internal": secret } : {}),
      },
      body: JSON.stringify({ deliveryId }),
    })
  } catch {
    // Worker due-poller will pick up queued rows.
  }
}

async function deliveryCountsByCampaign(
  campaignIds: string[]
): Promise<
  Map<string, { sent: number; failed: number; queued: number; clicked: number }>
> {
  const map = new Map<
    string,
    { sent: number; failed: number; queued: number; clicked: number }
  >()
  if (campaignIds.length === 0) return map

  const rows = await db
    .select({
      campaignId: webPushDeliveries.campaignId,
      status: webPushDeliveries.status,
      total: count(),
    })
    .from(webPushDeliveries)
    .where(inArray(webPushDeliveries.campaignId, campaignIds))
    .groupBy(webPushDeliveries.campaignId, webPushDeliveries.status)

  for (const row of rows) {
    const current = map.get(row.campaignId) ?? {
      sent: 0,
      failed: 0,
      queued: 0,
      clicked: 0,
    }
    if (row.status === "sent") current.sent = Number(row.total)
    else if (row.status === "clicked") {
      current.clicked = Number(row.total)
      current.sent += Number(row.total)
    } else if (row.status === "failed") current.failed = Number(row.total)
    else if (row.status === "queued" || row.status === "sending") {
      current.queued += Number(row.total)
    }
    map.set(row.campaignId, current)
  }
  return map
}

export async function loadNotificationCenterDashboard(
  actorId: string,
  routeSegment: string
): Promise<
  | { ok: true; data: NotificationCenterDashboardData }
  | { ok: false; status: number; error: string }
> {
  const landing = await getActiveLandingPageForActor(actorId, routeSegment)
  if (!landing) {
    return { ok: false, status: 404, error: "Landing page not found" }
  }

  const [
    vapidRows,
    siteConfigRows,
    campaignRows,
    subRows,
    deliveryRows,
    statsSub,
    statsCamp,
  ] = await Promise.all([
    db
      .select()
      .from(webPushVapidKeys)
      .where(eq(webPushVapidKeys.landingPageId, landing.id))
      .limit(1),
    db
      .select()
      .from(webPushSiteConfigs)
      .where(eq(webPushSiteConfigs.landingPageId, landing.id))
      .limit(1),
    db
      .select()
      .from(webPushCampaigns)
      .where(eq(webPushCampaigns.landingPageId, landing.id))
      .orderBy(desc(webPushCampaigns.updatedAt)),
    db
      .select()
      .from(webPushSubscriptions)
      .where(eq(webPushSubscriptions.landingPageId, landing.id))
      .orderBy(desc(webPushSubscriptions.updatedAt))
      .limit(50),
    db
      .select({
        id: webPushDeliveries.id,
        campaignId: webPushDeliveries.campaignId,
        status: webPushDeliveries.status,
        scheduledFor: webPushDeliveries.scheduledFor,
        sentAt: webPushDeliveries.sentAt,
        clickedAt: webPushDeliveries.clickedAt,
        failureReason: webPushDeliveries.failureReason,
        createdAt: webPushDeliveries.createdAt,
        targetUrl: webPushDeliveries.targetUrl,
        clickId: webPushDeliveries.clickId,
        campaignName: webPushCampaigns.name,
      })
      .from(webPushDeliveries)
      .innerJoin(
        webPushCampaigns,
        eq(webPushDeliveries.campaignId, webPushCampaigns.id)
      )
      .where(eq(webPushDeliveries.landingPageId, landing.id))
      .orderBy(desc(webPushDeliveries.createdAt))
      .limit(40),
    db
      .select({
        status: webPushSubscriptions.status,
        total: count(),
      })
      .from(webPushSubscriptions)
      .where(eq(webPushSubscriptions.landingPageId, landing.id))
      .groupBy(webPushSubscriptions.status),
    db
      .select({
        status: webPushCampaigns.status,
        total: count(),
      })
      .from(webPushCampaigns)
      .where(eq(webPushCampaigns.landingPageId, landing.id))
      .groupBy(webPushCampaigns.status),
  ])

  const deliveryAgg = await db
    .select({
      status: webPushDeliveries.status,
      total: count(),
    })
    .from(webPushDeliveries)
    .where(eq(webPushDeliveries.landingPageId, landing.id))
    .groupBy(webPushDeliveries.status)

  const campaignCounts = await deliveryCountsByCampaign(
    campaignRows.map((c) => c.id)
  )

  const stats: NotificationCenterStats = {
    activeSubscriptions: 0,
    inactiveSubscriptions: 0,
    campaignsActive: 0,
    campaignsPaused: 0,
    campaignsDraft: 0,
    sentCount: 0,
    failedCount: 0,
    queuedCount: 0,
    clickedCount: 0,
  }

  for (const row of statsSub) {
    if (row.status === "active") stats.activeSubscriptions = Number(row.total)
    else stats.inactiveSubscriptions += Number(row.total)
  }
  for (const row of statsCamp) {
    if (row.status === "active") stats.campaignsActive = Number(row.total)
    else if (row.status === "paused") stats.campaignsPaused = Number(row.total)
    else if (row.status === "draft") stats.campaignsDraft = Number(row.total)
  }
  for (const row of deliveryAgg) {
    if (row.status === "sent") stats.sentCount += Number(row.total)
    else if (row.status === "clicked") {
      stats.clickedCount = Number(row.total)
      stats.sentCount += Number(row.total)
    } else if (row.status === "failed") stats.failedCount = Number(row.total)
    else if (row.status === "queued" || row.status === "sending") {
      stats.queuedCount += Number(row.total)
    }
  }

  const vapidRow = vapidRows[0]
  const vapid: NotificationCenterVapid | null = vapidRow
    ? {
        id: vapidRow.id,
        publicKey: vapidRow.publicKey,
        subject: vapidRow.subject,
        createdAt: vapidRow.createdAt.toISOString(),
        rotatedAt: vapidRow.rotatedAt?.toISOString() ?? null,
        hasPrivateKey: true,
      }
    : null

  const campaigns: NotificationCenterCampaign[] = campaignRows.map((c) => {
    const counts = campaignCounts.get(c.id) ?? {
      sent: 0,
      failed: 0,
      queued: 0,
      clicked: 0,
    }
    return {
      id: c.id,
      name: c.name,
      title: c.title,
      body: c.body,
      iconUrl: c.iconUrl,
      badgeUrl: c.badgeUrl,
      imageUrl: c.imageUrl,
      tag: c.tag,
      requireInteraction: c.requireInteraction,
      click: c.click,
      trigger: c.trigger,
      limits: c.limits,
      status: c.status as NotificationCenterCampaign["status"],
      createdAt: c.createdAt.toISOString(),
      updatedAt: c.updatedAt.toISOString(),
      sentCount: counts.sent,
      failedCount: counts.failed,
      queuedCount: counts.queued,
      clickedCount: counts.clicked,
    }
  })

  const subscriptions: NotificationCenterSubscription[] = subRows.map((s) => ({
    id: s.id,
    endpointHash: s.endpointHash,
    status: s.status,
    origin: s.origin,
    lastSeenUrl: s.lastSeenUrl,
    createdAt: s.createdAt.toISOString(),
    lastEventAt: s.lastEventAt?.toISOString() ?? null,
  }))

  const recentDeliveries: NotificationCenterDelivery[] = deliveryRows.map(
    (d) => ({
      id: d.id,
      campaignId: d.campaignId,
      campaignName: d.campaignName,
      status: d.status,
      scheduledFor: d.scheduledFor.toISOString(),
      sentAt: d.sentAt?.toISOString() ?? null,
      clickedAt: d.clickedAt?.toISOString() ?? null,
      failureReason: d.failureReason,
      createdAt: d.createdAt.toISOString(),
      targetUrl: d.targetUrl,
      clickId: d.clickId,
    })
  )

  const siteConfig = siteConfigRows[0]
  const webhook: NotificationCenterWebhook = siteConfig
    ? {
        configured: true,
        secretPrefix: siteConfig.webhookSecretPrefix,
        rotatedAt: siteConfig.rotatedAt?.toISOString() ?? null,
      }
    : {
        configured: false,
        secretPrefix: null,
        rotatedAt: null,
      }

  return {
    ok: true,
    data: {
      projectId: landing.slug,
      landingPageId: landing.id,
      landingPagePublicId: landing.publicId,
      origin: landing.origin,
      ingestBaseUrl: resolveIngestApiBase() ?? null,
      clickBaseUrl:
        process.env.WEB_PUSH_CLICK_BASE_URL?.trim() ||
        resolveIngestApiBase() ||
        (process.env.NODE_ENV === "development"
          ? "http://127.0.0.1:3001"
          : null),
      mediaUploadConfigured: isWebPushMediaUploadConfigured(),
      stats,
      vapid,
      webhook,
      campaigns,
      subscriptions,
      recentDeliveries,
    },
  }
}

function validateCampaignInput(input: CampaignWriteInput): string | null {
  if (!input.name?.trim()) return "Name is required"
  if (!input.title?.trim()) return "Title is required"
  if (input.title.trim().length > 64)
    return "Title should be 64 characters or fewer"
  if (!isHttpsUrl(input.iconUrl)) return "Icon URL must be HTTPS"
  if (!isHttpsUrl(input.badgeUrl)) return "Badge URL must be HTTPS"
  if (!isHttpsUrl(input.imageUrl)) return "Image URL must be HTTPS"
  if (!input.click?.mode) return "Click mode is required"
  if (input.click.mode === "fixed" && !input.click.fixedUrl?.trim()) {
    return "Fixed click URL is required"
  }
  if (input.click.mode === "fixed" && !isHttpsUrl(input.click.fixedUrl)) {
    return "Fixed click URL must be HTTPS"
  }
  if (input.click.mode === "template" && !input.click.urlTemplate?.trim()) {
    return "URL template is required"
  }
  if (!input.trigger?.type) return "Trigger is required"
  if (
    (input.trigger.type === "delay_after_event" ||
      input.trigger.type === "drip") &&
    !input.trigger.event?.trim()
  ) {
    return "Trigger event is required"
  }
  if (input.trigger.type === "drip") {
    const steps = input.trigger.steps ?? []
    if (steps.length === 0) return "Drip campaigns need at least one step"
    for (const step of steps) {
      if (!Number.isFinite(Number(step.delayMs)) || Number(step.delayMs) < 0) {
        return "Each drip step needs a non-negative delay"
      }
    }
  }
  const quiet = input.limits?.quietHours
  if (quiet) {
    if (
      !/^\d{1,2}:\d{2}$/.test(quiet.start) ||
      !/^\d{1,2}:\d{2}$/.test(quiet.end)
    ) {
      return "Quiet hours must use HH:mm format"
    }
  }
  return null
}

export async function createWebPushCampaignForLanding(
  actorId: string,
  routeSegment: string,
  input: CampaignWriteInput
): Promise<
  | { ok: true; campaignId: string }
  | { ok: false; status: number; error: string }
> {
  const landing = await getActiveLandingPageForActor(actorId, routeSegment)
  if (!landing)
    return { ok: false, status: 404, error: "Landing page not found" }

  const error = validateCampaignInput(input)
  if (error) return { ok: false, status: 400, error }

  const id = crypto.randomUUID()
  const now = new Date()
  await db.insert(webPushCampaigns).values({
    id,
    landingPageId: landing.id,
    name: input.name.trim(),
    title: input.title.trim(),
    body: input.body?.trim() || null,
    iconUrl: input.iconUrl?.trim() || null,
    badgeUrl: input.badgeUrl?.trim() || null,
    imageUrl: input.imageUrl?.trim() || null,
    tag: input.tag?.trim() || null,
    requireInteraction: Boolean(input.requireInteraction),
    click: input.click,
    trigger: input.trigger,
    limits: input.limits ?? null,
    status: input.status ?? "draft",
    createdAt: now,
    updatedAt: now,
  })
  return { ok: true, campaignId: id }
}

export async function updateWebPushCampaignForLanding(
  actorId: string,
  routeSegment: string,
  campaignId: string,
  input: Partial<CampaignWriteInput> & { status?: CampaignWriteInput["status"] }
): Promise<{ ok: true } | { ok: false; status: number; error: string }> {
  const landing = await getActiveLandingPageForActor(actorId, routeSegment)
  if (!landing)
    return { ok: false, status: 404, error: "Landing page not found" }

  const existing = await db
    .select()
    .from(webPushCampaigns)
    .where(
      and(
        eq(webPushCampaigns.id, campaignId),
        eq(webPushCampaigns.landingPageId, landing.id)
      )
    )
    .limit(1)

  if (!existing[0])
    return { ok: false, status: 404, error: "Campaign not found" }

  const merged: CampaignWriteInput = {
    name: input.name ?? existing[0].name,
    title: input.title ?? existing[0].title,
    body: input.body !== undefined ? input.body : existing[0].body,
    iconUrl: input.iconUrl !== undefined ? input.iconUrl : existing[0].iconUrl,
    badgeUrl:
      input.badgeUrl !== undefined ? input.badgeUrl : existing[0].badgeUrl,
    imageUrl:
      input.imageUrl !== undefined ? input.imageUrl : existing[0].imageUrl,
    tag: input.tag !== undefined ? input.tag : existing[0].tag,
    requireInteraction:
      input.requireInteraction ?? existing[0].requireInteraction,
    click: input.click ?? existing[0].click,
    trigger: input.trigger ?? existing[0].trigger,
    limits: input.limits !== undefined ? input.limits : existing[0].limits,
    status:
      input.status ?? (existing[0].status as CampaignWriteInput["status"]),
  }

  const error = validateCampaignInput(merged)
  if (error) return { ok: false, status: 400, error }

  await db
    .update(webPushCampaigns)
    .set({
      name: merged.name.trim(),
      title: merged.title.trim(),
      body: merged.body?.trim() || null,
      iconUrl: merged.iconUrl?.trim() || null,
      badgeUrl: merged.badgeUrl?.trim() || null,
      imageUrl: merged.imageUrl?.trim() || null,
      tag: merged.tag?.trim() || null,
      requireInteraction: Boolean(merged.requireInteraction),
      click: merged.click,
      trigger: merged.trigger,
      limits: merged.limits ?? null,
      status: merged.status ?? existing[0].status,
      updatedAt: new Date(),
    })
    .where(eq(webPushCampaigns.id, campaignId))

  return { ok: true }
}

export async function generateVapidForLanding(
  actorId: string,
  routeSegment: string,
  subject?: string
): Promise<
  { ok: true; publicKey: string } | { ok: false; status: number; error: string }
> {
  const landing = await getActiveLandingPageForActor(actorId, routeSegment)
  if (!landing)
    return { ok: false, status: 404, error: "Landing page not found" }

  const keys = webpush.generateVAPIDKeys()
  const encrypted = encryptVapidPrivateKey(keys.privateKey)
  const vapidSubject =
    subject?.trim() ||
    process.env.WEB_PUSH_VAPID_SUBJECT?.trim() ||
    "mailto:ops@arohaa.net"

  const existing = await db
    .select({ id: webPushVapidKeys.id })
    .from(webPushVapidKeys)
    .where(eq(webPushVapidKeys.landingPageId, landing.id))
    .limit(1)

  const now = new Date()
  if (existing[0]) {
    await db
      .update(webPushVapidKeys)
      .set({
        publicKey: keys.publicKey,
        privateKeyEncrypted: encrypted,
        subject: vapidSubject,
        rotatedAt: now,
      })
      .where(eq(webPushVapidKeys.id, existing[0].id))
  } else {
    await db.insert(webPushVapidKeys).values({
      id: crypto.randomUUID(),
      landingPageId: landing.id,
      publicKey: keys.publicKey,
      privateKeyEncrypted: encrypted,
      subject: vapidSubject,
      createdAt: now,
      rotatedAt: null,
    })
  }

  // Touch to ensure decrypt works with current secret
  decryptVapidPrivateKey(encrypted)

  return { ok: true, publicKey: keys.publicKey }
}

export async function generateWebhookSecretForLanding(
  actorId: string,
  routeSegment: string
): Promise<
  | { ok: true; secret: string; prefix: string }
  | { ok: false; status: number; error: string }
> {
  const landing = await getActiveLandingPageForActor(actorId, routeSegment)
  if (!landing)
    return { ok: false, status: 404, error: "Landing page not found" }

  const secret = generateWebhookSecret()
  const encrypted = encryptWebhookSecret(secret)
  const prefix = secret.slice(0, 10)
  const now = new Date()

  const existing = await db
    .select({ id: webPushSiteConfigs.id })
    .from(webPushSiteConfigs)
    .where(eq(webPushSiteConfigs.landingPageId, landing.id))
    .limit(1)

  if (existing[0]) {
    await db
      .update(webPushSiteConfigs)
      .set({
        webhookSecretEncrypted: encrypted,
        webhookSecretPrefix: prefix,
        rotatedAt: now,
      })
      .where(eq(webPushSiteConfigs.id, existing[0].id))
  } else {
    await db.insert(webPushSiteConfigs).values({
      id: crypto.randomUUID(),
      landingPageId: landing.id,
      webhookSecretEncrypted: encrypted,
      webhookSecretPrefix: prefix,
      createdAt: now,
      rotatedAt: null,
    })
  }

  return { ok: true, secret, prefix }
}

export async function sendCampaignNow(
  actorId: string,
  routeSegment: string,
  campaignId: string
): Promise<
  { ok: true; created: number } | { ok: false; status: number; error: string }
> {
  const landing = await getActiveLandingPageForActor(actorId, routeSegment)
  if (!landing)
    return { ok: false, status: 404, error: "Landing page not found" }

  const campaign = await db
    .select({ id: webPushCampaigns.id, status: webPushCampaigns.status })
    .from(webPushCampaigns)
    .where(
      and(
        eq(webPushCampaigns.id, campaignId),
        eq(webPushCampaigns.landingPageId, landing.id)
      )
    )
    .limit(1)

  if (!campaign[0])
    return { ok: false, status: 404, error: "Campaign not found" }

  const vapid = await db
    .select({ id: webPushVapidKeys.id })
    .from(webPushVapidKeys)
    .where(eq(webPushVapidKeys.landingPageId, landing.id))
    .limit(1)
  if (!vapid[0]) {
    return {
      ok: false,
      status: 400,
      error: "Generate a VAPID key pair before sending",
    }
  }

  const result = await createManualDeliveries({
    campaignId: campaign[0].id,
    landingPageId: landing.id,
    enqueue: enqueueDelivery,
  })

  return { ok: true, created: result.created }
}
