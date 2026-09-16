import type {
  WebPushCampaignClick,
  WebPushCampaignLimits,
  WebPushCampaignTrigger,
} from "@workspace/database"

export type NotificationCenterVapid = {
  id: string
  publicKey: string
  subject: string
  createdAt: string
  rotatedAt: string | null
  hasPrivateKey: true
}

export type NotificationCenterCampaign = {
  id: string
  name: string
  title: string
  body: string | null
  iconUrl: string | null
  badgeUrl: string | null
  imageUrl: string | null
  tag: string | null
  requireInteraction: boolean
  click: WebPushCampaignClick
  trigger: WebPushCampaignTrigger
  limits: WebPushCampaignLimits | null
  status: "draft" | "active" | "paused"
  createdAt: string
  updatedAt: string
  sentCount: number
  failedCount: number
  queuedCount: number
  clickedCount: number
}

export type NotificationCenterSubscription = {
  id: string
  endpointHash: string
  status: string
  origin: string | null
  lastSeenUrl: string | null
  createdAt: string
  lastEventAt: string | null
}

export type NotificationCenterDelivery = {
  id: string
  campaignId: string
  campaignName: string
  status: string
  scheduledFor: string
  sentAt: string | null
  clickedAt: string | null
  failureReason: string | null
  createdAt: string
  targetUrl: string | null
  clickId: string | null
}

export type NotificationCenterStats = {
  activeSubscriptions: number
  inactiveSubscriptions: number
  campaignsActive: number
  campaignsPaused: number
  campaignsDraft: number
  sentCount: number
  failedCount: number
  queuedCount: number
  clickedCount: number
}

export type NotificationCenterWebhook = {
  configured: boolean
  secretPrefix: string | null
  rotatedAt: string | null
  /** Only present immediately after generate/rotate */
  plaintextSecret?: string
}

export type NotificationCenterDashboardData = {
  projectId: string
  landingPageId: string
  landingPagePublicId: string
  origin: string
  ingestBaseUrl: string | null
  clickBaseUrl: string | null
  mediaUploadConfigured: boolean
  stats: NotificationCenterStats
  vapid: NotificationCenterVapid | null
  webhook: NotificationCenterWebhook
  campaigns: NotificationCenterCampaign[]
  subscriptions: NotificationCenterSubscription[]
  recentDeliveries: NotificationCenterDelivery[]
}

export const WEB_PUSH_TRIGGER_EVENTS = [
  "page_hidden",
  "page_visible",
  "page_unload",
  "form_start",
  "form_step_view",
  "form_submit",
  "form_success",
  "form_abandon",
  "zip_submit",
  "call_not_clicked",
  "push_subscribed",
  "unsubscribe",
] as const

export type WebPushTriggerEvent = (typeof WEB_PUSH_TRIGGER_EVENTS)[number]
