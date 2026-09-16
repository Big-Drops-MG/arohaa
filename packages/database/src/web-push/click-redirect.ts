import { and, eq } from "drizzle-orm"
import { db } from "../index.js"
import { landingPages } from "../schema/landing-pages.js"
import {
  webPushCampaigns,
  webPushDeliveries,
  webPushSubscriptions,
  type WebPushCampaignClick,
  type WebPushSubscriptionContext,
} from "../schema/web-push.js"
import { resolveWebPushClickUrl } from "./click-url.js"

function resolveClickPublicBase(): string | null {
  const configured =
    process.env.WEB_PUSH_CLICK_BASE_URL?.trim() ||
    process.env.INGEST_BASE_URL?.trim() ||
    process.env.NEXT_PUBLIC_AROHAA_INGEST_API_BASE?.trim()
  if (configured) return configured.replace(/\/$/, "")
  if (process.env.NODE_ENV === "development") return "http://127.0.0.1:3001"
  return null
}

export function buildMaskedClickUrl(clickId: string): string | null {
  const base = resolveClickPublicBase()
  if (!base) return null
  return `${base}/r/${encodeURIComponent(clickId)}`
}

export function shouldUseMaskedRedirect(
  click: WebPushCampaignClick | null | undefined
): boolean {
  if (click?.maskedRedirect === false) return false
  return Boolean(resolveClickPublicBase())
}

export async function resolveClickRedirect(token: string): Promise<
  | { ok: true; url: string; deliveryId: string }
  | { ok: false; status: number; error: string }
> {
  const clickId = token.trim()
  if (!clickId) return { ok: false, status: 400, error: "token required" }

  const rows = await db
    .select({
      id: webPushDeliveries.id,
      targetUrl: webPushDeliveries.targetUrl,
      clickedAt: webPushDeliveries.clickedAt,
      status: webPushDeliveries.status,
      click: webPushCampaigns.click,
      subscriptionId: webPushDeliveries.subscriptionId,
      campaignId: webPushDeliveries.campaignId,
      landingPageId: webPushDeliveries.landingPageId,
      lastSeenUrl: webPushSubscriptions.lastSeenUrl,
      origin: webPushSubscriptions.origin,
      context: webPushSubscriptions.context,
      landingPagePublicId: landingPages.publicId,
    })
    .from(webPushDeliveries)
    .innerJoin(
      webPushCampaigns,
      eq(webPushDeliveries.campaignId, webPushCampaigns.id)
    )
    .innerJoin(
      webPushSubscriptions,
      eq(webPushDeliveries.subscriptionId, webPushSubscriptions.id)
    )
    .innerJoin(
      landingPages,
      eq(webPushDeliveries.landingPageId, landingPages.id)
    )
    .where(eq(webPushDeliveries.clickId, clickId))
    .limit(1)

  const row = rows[0]
  if (!row) return { ok: false, status: 404, error: "click not found" }

  const click = row.click as WebPushCampaignClick
  const resumeMode = click.resumeMode === "fresh" ? "fresh" : "frozen"

  let destination = (row.targetUrl ?? "").trim()
  if (resumeMode === "fresh" || !destination) {
    destination = resolveWebPushClickUrl({
      click,
      campaignId: row.campaignId,
      landingPageId: row.landingPageId,
      landingPagePublicId: row.landingPagePublicId,
      subscriptionId: row.subscriptionId,
      origin: row.origin,
      lastSeenUrl: row.lastSeenUrl,
      context: row.context as WebPushSubscriptionContext | null,
    })
  }

  if (!destination || !/^https?:\/\//i.test(destination)) {
    return { ok: false, status: 410, error: "destination unavailable" }
  }

  if (!row.clickedAt) {
    const nextStatus =
      row.status === "sent" || row.status === "clicked" ? "clicked" : row.status
    await db
      .update(webPushDeliveries)
      .set({
        clickedAt: new Date(),
        updatedAt: new Date(),
        status: nextStatus,
      })
      .where(
        and(eq(webPushDeliveries.id, row.id), eq(webPushDeliveries.clickId, clickId))
      )
  }

  return { ok: true, url: destination, deliveryId: row.id }
}
