import type { NotificationCenterAnalyticsData } from "@/features/notification-center/model/notification-center"

export function getNotificationCenterAnalyticsEmpty(
  rangeId: string
): NotificationCenterAnalyticsData {
  return {
    range: {
      rangeId,
      from: "",
      to: "",
      start: new Date(0).toISOString(),
      end: new Date(0).toISOString(),
    },
    kpis: {
      activeSubs: 0,
      newSubs: 0,
      churnedSubs: 0,
      sent: 0,
      clicked: 0,
      failed: 0,
      cancelled: 0,
      queued: 0,
      displayed: 0,
      dismissed: 0,
      ctr: 0,
      engagedCtr: 0,
      failRate: 0,
      cancelRate: 0,
      medianTimeToClickMs: null,
      attributedConversions: 0,
      attributedCvr: 0,
    },
    series: [],
    funnel: [
      { id: "queued", label: "Queued", value: 0 },
      { id: "sent", label: "Sent", value: 0 },
      { id: "clicked", label: "Clicked", value: 0 },
    ],
    conversionFunnel: [
      { id: "sent", label: "Sent", value: 0 },
      { id: "clicked", label: "Clicked", value: 0 },
      { id: "converted", label: "Converted", value: 0 },
    ],
    failures: [],
    cancels: [],
    campaigns: [],
    dripSteps: [],
    segments: { byUtmSource: [], byPath: [], byZip: [] },
    heatmap: [],
    insights: [],
    warnings: [],
    recentDeliveries: [],
    subscriptions: [],
  }
}
