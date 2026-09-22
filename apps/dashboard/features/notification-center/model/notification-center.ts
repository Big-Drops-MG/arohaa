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

export type NotificationCenterAnalyticsKpis = {
  activeSubs: number
  newSubs: number
  churnedSubs: number
  sent: number
  clicked: number
  failed: number
  cancelled: number
  queued: number
  displayed: number
  dismissed: number
  ctr: number
  engagedCtr: number
  failRate: number
  cancelRate: number
  medianTimeToClickMs: number | null
  attributedConversions: number
  attributedCvr: number
}

export type NotificationCenterSeriesPoint = {
  day: string
  label: string
  sent: number
  clicked: number
  failed: number
  newActive: number
  churned: number
}

export type NotificationCenterFunnelStep = {
  id: string
  label: string
  value: number
}

export type NotificationCenterBreakdownRow = {
  key: string
  label: string
  count: number
}

export type NotificationCenterCampaignAnalyticsRow = {
  id: string
  name: string
  sent: number
  clicked: number
  failed: number
  cancelled: number
  displayed: number
  ctr: number
  conversions: number
  cvr: number
  maskedRedirect: boolean
}

export type NotificationCenterDripStepRow = {
  step: number
  sent: number
  clicked: number
  ctr: number
}

export type NotificationCenterSegmentRow = {
  key: string
  label: string
  sent: number
  clicked: number
  ctr: number
}

export type NotificationCenterHeatmapCell = {
  dow: number
  hour: number
  sent: number
  clicked: number
}

export type NotificationCenterInsight = {
  id: string
  tone: "positive" | "warning" | "neutral"
  title: string
  detail: string
}

export type NotificationCenterAnalyticsData = {
  range: {
    rangeId: string
    from: string
    to: string
    start: string
    end: string
  }
  kpis: NotificationCenterAnalyticsKpis
  series: NotificationCenterSeriesPoint[]
  funnel: NotificationCenterFunnelStep[]
  conversionFunnel: NotificationCenterFunnelStep[]
  failures: NotificationCenterBreakdownRow[]
  cancels: NotificationCenterBreakdownRow[]
  campaigns: NotificationCenterCampaignAnalyticsRow[]
  dripSteps: NotificationCenterDripStepRow[]
  segments: {
    byUtmSource: NotificationCenterSegmentRow[]
    byPath: NotificationCenterSegmentRow[]
    byZip: NotificationCenterSegmentRow[]
  }
  heatmap: NotificationCenterHeatmapCell[]
  insights: NotificationCenterInsight[]
  warnings: string[]
  recentDeliveries: NotificationCenterDelivery[]
  subscriptions: NotificationCenterSubscription[]
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
  "push_permission_prompted",
  "push_permission_granted",
  "push_permission_denied",
  "push_displayed",
  "push_dismissed",
] as const

export type WebPushTriggerEvent = (typeof WEB_PUSH_TRIGGER_EVENTS)[number]
