import {
  boolean,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core"
import { sql } from "drizzle-orm"
import { landingPages } from "./landing-pages.js"

export type WebPushSubscriptionContext = {
  pageUrl?: string | null
  pagePath?: string | null
  query?: Record<string, string> | null
  utm?: Record<string, string> | null
  userAgent?: string | null
  timezone?: string | null
  sessionId?: string | null
  zip?: string | null
  step?: number | string | null
  [key: string]: unknown
}

export type WebPushCampaignClick = {
  mode: "fixed" | "template" | "last_url"
  urlTemplate?: string | null
  fixedUrl?: string | null
  appendUtms?: Record<string, string> | null
  /** When true (default), push opens Arohaa /r/:token which 302s to the real URL. */
  maskedRedirect?: boolean | null
  /**
   * frozen = destination captured at send time (recommended for abandon).
   * fresh = re-resolve from subscription lastSeenUrl at click time.
   */
  resumeMode?: "frozen" | "fresh" | null
}

export type WebPushDripStep = {
  /** Delay from the triggering event (absolute), not from previous step. */
  delayMs: number
  title?: string | null
  body?: string | null
  tag?: string | null
  iconUrl?: string | null
  badgeUrl?: string | null
  imageUrl?: string | null
}

export type WebPushCampaignTrigger = {
  type: "delay_after_event" | "immediate" | "drip"
  event?: string | null
  delayMs?: number | null
  cancelOn?: string[] | null
  /** Used when type === "drip". Each step becomes its own delivery. */
  steps?: WebPushDripStep[] | null
}

export type WebPushQuietHours = {
  /** HH:mm local */
  start: string
  /** HH:mm local */
  end: string
  /** IANA tz or "user" to use subscription timezone */
  tz: "user" | string
}

export type WebPushCampaignLimits = {
  maxPerUserPerDay?: number | null
  ttlMs?: number | null
  quietHours?: WebPushQuietHours | null
}

export type WebPushDeliveryCreativeOverride = {
  title?: string | null
  body?: string | null
  tag?: string | null
  iconUrl?: string | null
  badgeUrl?: string | null
  imageUrl?: string | null
}

export const webPushVapidKeys = pgTable(
  "web_push_vapid_key",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    landingPageId: text("landingPageId")
      .notNull()
      .references(() => landingPages.id, { onDelete: "cascade" }),
    publicKey: text("publicKey").notNull(),
    privateKeyEncrypted: text("privateKeyEncrypted").notNull(),
    subject: text("subject").notNull().default("mailto:ops@arohaa.net"),
    createdAt: timestamp("createdAt", { mode: "date" }).notNull().defaultNow(),
    rotatedAt: timestamp("rotatedAt", { mode: "date" }),
  },
  (t) => ({
    landingUid: uniqueIndex("web_push_vapid_key_landing_uidx").on(
      t.landingPageId
    ),
  })
)

export const webPushSiteConfigs = pgTable(
  "web_push_site_config",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    landingPageId: text("landingPageId")
      .notNull()
      .references(() => landingPages.id, { onDelete: "cascade" }),
    webhookSecretEncrypted: text("webhookSecretEncrypted").notNull(),
    webhookSecretPrefix: text("webhookSecretPrefix").notNull(),
    createdAt: timestamp("createdAt", { mode: "date" }).notNull().defaultNow(),
    rotatedAt: timestamp("rotatedAt", { mode: "date" }),
  },
  (t) => ({
    landingUid: uniqueIndex("web_push_site_config_landing_uidx").on(
      t.landingPageId
    ),
  })
)

export const webPushMediaAssets = pgTable(
  "web_push_media_asset",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    landingPageId: text("landingPageId")
      .notNull()
      .references(() => landingPages.id, { onDelete: "cascade" }),
    kind: text("kind").notNull(),
    fileName: text("fileName").notNull(),
    contentType: text("contentType").notNull(),
    byteSize: integer("byteSize").notNull(),
    publicUrl: text("publicUrl").notNull(),
    storageKey: text("storageKey"),
    createdAt: timestamp("createdAt", { mode: "date" }).notNull().defaultNow(),
  },
  (t) => ({
    landingCreatedIdx: index("web_push_media_asset_landing_idx").on(
      t.landingPageId,
      t.createdAt
    ),
  })
)

export const webPushSubscriptions = pgTable(
  "web_push_subscription",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    landingPageId: text("landingPageId")
      .notNull()
      .references(() => landingPages.id, { onDelete: "cascade" }),
    vapidKeyId: text("vapidKeyId").references(() => webPushVapidKeys.id, {
      onDelete: "set null",
    }),
    endpoint: text("endpoint").notNull(),
    endpointHash: text("endpointHash").notNull(),
    p256dh: text("p256dh").notNull(),
    auth: text("auth").notNull(),
    expirationTime: timestamp("expirationTime", { mode: "date" }),
    origin: text("origin"),
    lastSeenUrl: text("lastSeenUrl"),
    context: jsonb("context").$type<WebPushSubscriptionContext | null>(),
    status: text("status").notNull().default("active"),
    createdAt: timestamp("createdAt", { mode: "date" }).notNull().defaultNow(),
    updatedAt: timestamp("updatedAt", { mode: "date" }).notNull().defaultNow(),
    lastEventAt: timestamp("lastEventAt", { mode: "date" }),
  },
  (t) => ({
    endpointUid: uniqueIndex("web_push_subscription_endpoint_uidx").on(
      t.endpoint
    ),
    landingStatusIdx: index("web_push_subscription_landing_status_idx").on(
      t.landingPageId,
      t.status
    ),
    endpointHashIdx: index("web_push_subscription_endpoint_hash_idx").on(
      t.endpointHash
    ),
  })
)

export const webPushCampaigns = pgTable(
  "web_push_campaign",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    landingPageId: text("landingPageId")
      .notNull()
      .references(() => landingPages.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    title: text("title").notNull(),
    body: text("body"),
    iconUrl: text("iconUrl"),
    badgeUrl: text("badgeUrl"),
    imageUrl: text("imageUrl"),
    tag: text("tag"),
    requireInteraction: boolean("requireInteraction").notNull().default(false),
    click: jsonb("click").$type<WebPushCampaignClick>().notNull(),
    trigger: jsonb("trigger").$type<WebPushCampaignTrigger>().notNull(),
    limits: jsonb("limits").$type<WebPushCampaignLimits | null>(),
    status: text("status").notNull().default("draft"),
    createdAt: timestamp("createdAt", { mode: "date" }).notNull().defaultNow(),
    updatedAt: timestamp("updatedAt", { mode: "date" }).notNull().defaultNow(),
  },
  (t) => ({
    landingStatusIdx: index("web_push_campaign_landing_status_idx").on(
      t.landingPageId,
      t.status
    ),
  })
)

export const webPushDeliveries = pgTable(
  "web_push_delivery",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    campaignId: text("campaignId")
      .notNull()
      .references(() => webPushCampaigns.id, { onDelete: "cascade" }),
    subscriptionId: text("subscriptionId")
      .notNull()
      .references(() => webPushSubscriptions.id, { onDelete: "cascade" }),
    landingPageId: text("landingPageId")
      .notNull()
      .references(() => landingPages.id, { onDelete: "cascade" }),
    status: text("status").notNull().default("queued"),
    scheduledFor: timestamp("scheduledFor", { mode: "date" }).notNull(),
    sentAt: timestamp("sentAt", { mode: "date" }),
    clickedAt: timestamp("clickedAt", { mode: "date" }),
    failureCode: integer("failureCode"),
    failureReason: text("failureReason"),
    clickId: text("clickId"),
    targetUrl: text("targetUrl"),
    dripStepIndex: integer("dripStepIndex"),
    sequenceId: text("sequenceId"),
    creativeOverride: jsonb(
      "creativeOverride"
    ).$type<WebPushDeliveryCreativeOverride | null>(),
    payloadSnapshot: jsonb("payloadSnapshot").$type<Record<
      string,
      unknown
    > | null>(),
    createdAt: timestamp("createdAt", { mode: "date" }).notNull().defaultNow(),
    updatedAt: timestamp("updatedAt", { mode: "date" }).notNull().defaultNow(),
  },
  (t) => ({
    statusScheduledIdx: index("web_push_delivery_status_scheduled_idx")
      .on(t.status, t.scheduledFor)
      .where(sql`${t.status} = 'queued'`),
    campaignSubIdx: index("web_push_delivery_campaign_sub_idx").on(
      t.campaignId,
      t.subscriptionId,
      t.status
    ),
    landingCreatedIdx: index("web_push_delivery_landing_created_idx").on(
      t.landingPageId,
      t.createdAt
    ),
    sequenceIdx: index("web_push_delivery_sequence_idx").on(t.sequenceId),
    clickIdUid: uniqueIndex("web_push_delivery_click_id_uidx")
      .on(t.clickId)
      .where(sql`${t.clickId} IS NOT NULL`),
  })
)
