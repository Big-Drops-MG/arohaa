import type { NotificationCenterDashboardData } from "@/features/notification-center/model/notification-center"

export function getNotificationCenterEmptyData(
  projectId: string
): NotificationCenterDashboardData {
  return {
    projectId,
    landingPageId: "",
    landingPagePublicId: "",
    origin: "",
    ingestBaseUrl: null,
    clickBaseUrl: null,
    mediaUploadConfigured: false,
    stats: {
      activeSubscriptions: 0,
      inactiveSubscriptions: 0,
      campaignsActive: 0,
      campaignsPaused: 0,
      campaignsDraft: 0,
      sentCount: 0,
      failedCount: 0,
      queuedCount: 0,
      clickedCount: 0,
    },
    vapid: null,
    webhook: {
      configured: false,
      secretPrefix: null,
      rotatedAt: null,
    },
    campaigns: [],
    subscriptions: [],
    recentDeliveries: [],
  }
}
