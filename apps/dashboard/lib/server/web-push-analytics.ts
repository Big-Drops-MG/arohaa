import {
  and,
  clickhouse,
  db,
  desc,
  eq,
  gte,
  inArray,
  lt,
  or,
  sql,
  webPushCampaigns,
  webPushClientEvents,
  webPushDeliveries,
  webPushSubscriptions,
  type WebPushCampaignClick,
  type WebPushSubscriptionContext,
} from "@workspace/database"
import { getActiveLandingPageForActor } from "@/lib/server/landing-pages-store"
import {
  formatNcDayLabel,
  resolveNotificationCenterAnalyticsWindow,
  seriesBucketKey,
} from "@/lib/server/web-push-analytics-range"
import type { OverviewDateRangeId } from "@/features/overview/model/overview"
import type { DashboardCustomRange } from "@/features/traffic/model/traffic-range"
import type {
  NotificationCenterAnalyticsData,
  NotificationCenterCampaignAnalyticsRow,
  NotificationCenterDelivery,
  NotificationCenterInsight,
  NotificationCenterSegmentRow,
  NotificationCenterSeriesPoint,
  NotificationCenterSubscription,
} from "@/features/notification-center/model/notification-center"
import { getDashboardZonedParts } from "@/lib/datetime"

function rate(n: number, d: number): number {
  if (d <= 0) return 0
  return Math.round((n / d) * 10000) / 10000
}

function pct(n: number, d: number): number {
  return Math.round(rate(n, d) * 1000) / 10
}

function median(values: number[]): number | null {
  if (values.length === 0) return null
  const sorted = [...values].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  if (sorted.length % 2 === 0) {
    return Math.round(((sorted[mid - 1] ?? 0) + (sorted[mid] ?? 0)) / 2)
  }
  return sorted[mid] ?? null
}

function isSentStatus(status: string): boolean {
  return status === "sent" || status === "clicked"
}

function inWindow(
  ts: Date | null | undefined,
  start: Date,
  end: Date
): boolean {
  if (!ts) return false
  const t = ts.getTime()
  return t >= start.getTime() && t < end.getTime()
}

function weekdayHourKey(ts: Date): string {
  const parts = getDashboardZonedParts(ts)
  const dow = Number(
    new Intl.DateTimeFormat("en-US", {
      timeZone: "America/New_York",
      weekday: "short",
    })
      .format(ts)
      .replace(
        /Sun|Mon|Tue|Wed|Thu|Fri|Sat/,
        (m) =>
          (
            ({
              Sun: "0",
              Mon: "1",
              Tue: "2",
              Wed: "3",
              Thu: "4",
              Fri: "5",
              Sat: "6",
            }) as Record<string, string>
          )[m] ?? "0"
      )
  )
  return `${dow}:${parts.hour}`
}

function timestampInRange(
  column: Parameters<typeof gte>[0],
  start: Date,
  end: Date
) {
  return and(gte(column, start), lt(column, end))
}

function parseCancelEvent(reason: string | null): string | null {
  if (!reason) return null
  const m = reason.match(/^cancelled_by_event:(.+)$/)
  return m?.[1]?.split(",")[0]?.trim() || null
}

function segmentBucket(
  map: Map<string, { sent: number; clicked: number }>,
  key: string,
  sentInc: number,
  clickInc: number
) {
  const label = key.trim() || "(none)"
  const cur = map.get(label) ?? { sent: 0, clicked: 0 }
  cur.sent += sentInc
  cur.clicked += clickInc
  map.set(label, cur)
}

function toSegmentRows(
  map: Map<string, { sent: number; clicked: number }>,
  limit = 12
): NotificationCenterSegmentRow[] {
  return [...map.entries()]
    .map(([label, v]) => ({
      key: label,
      label,
      sent: v.sent,
      clicked: v.clicked,
      ctr: rate(v.clicked, v.sent),
    }))
    .sort((a, b) => b.sent - a.sent || b.clicked - a.clicked)
    .slice(0, limit)
}

function buildInsights(input: {
  kpis: NotificationCenterAnalyticsData["kpis"]
  campaigns: NotificationCenterCampaignAnalyticsRow[]
  failures: { key: string; count: number }[]
  cancels: { key: string; count: number }[]
}): NotificationCenterInsight[] {
  const insights: NotificationCenterInsight[] = []
  const { kpis, campaigns, failures, cancels } = input

  if (kpis.sent > 0) {
    const avgCtr = kpis.ctr
    const best = [...campaigns].sort((a, b) => b.ctr - a.ctr)[0]
    if (best && best.sent >= 5 && best.ctr >= avgCtr * 1.5 && avgCtr > 0) {
      insights.push({
        id: "ctr-outlier",
        tone: "positive",
        title: `${best.name} CTR is ${(best.ctr / avgCtr).toFixed(1)}× average`,
        detail: `${pct(best.clicked, best.sent)}% click rate on ${best.sent} sends vs ${pct(kpis.clicked, kpis.sent)}% overall.`,
      })
    }
  }

  const gone = failures.find(
    (f) => f.key.includes("410") || f.key.toLowerCase().includes("gone")
  )
  if (gone && gone.count >= 3) {
    insights.push({
      id: "fail-410",
      tone: "warning",
      title: "Stale endpoints are failing",
      detail: `${gone.count} failures look like expired push endpoints. Inactive subs are cleaned on 410/404.`,
    })
  }

  const formCancel = cancels.find((c) => c.key.includes("form_success"))
  if (formCancel && formCancel.count >= 3) {
    insights.push({
      id: "cancel-recovery",
      tone: "positive",
      title: "Cancels track conversions",
      detail: `${formCancel.count} queued sends cancelled on form_success — abandon recovery is working.`,
    })
  }

  if (kpis.failRate >= 0.15 && kpis.sent + kpis.failed >= 20) {
    insights.push({
      id: "fail-rate",
      tone: "warning",
      title: "Fail rate is elevated",
      detail: `${pct(kpis.failed, kpis.sent + kpis.failed)}% of attempted sends failed in this range.`,
    })
  }

  if (kpis.churnedSubs > kpis.newSubs && kpis.churnedSubs >= 5) {
    insights.push({
      id: "churn",
      tone: "warning",
      title: "Unsubs outpaced new opt-ins",
      detail: `${kpis.churnedSubs} churned vs ${kpis.newSubs} new in range.`,
    })
  }

  if (insights.length === 0 && kpis.sent > 0) {
    insights.push({
      id: "baseline",
      tone: "neutral",
      title: "Delivery is stable",
      detail: `${kpis.sent} sends, ${pct(kpis.clicked, kpis.sent)}% CTR, ${kpis.failed} failures in range.`,
    })
  }

  return insights.slice(0, 5)
}

async function loadAttributedConversions(input: {
  workspaceId: string
  clickIds: string[]
  start: Date
  end: Date
}): Promise<Map<string, number>> {
  const map = new Map<string, number>()
  if (!clickhouse || input.clickIds.length === 0) return map

  try {
    const result = await clickhouse.query({
      query: `
        SELECT
          extractURLParameter(url, 'arohaa_click_id') AS click_id,
          count() AS conversions
        FROM events_raw
        WHERE workspace_id = {wid:UUID}
          AND created_at >= {start:DateTime64(3)}
          AND created_at < {end:DateTime64(3)}
          AND event_name IN ('form_success', 'zip_submit', 'service_click')
          AND extractURLParameter(url, 'arohaa_click_id') IN {clickIds:Array(String)}
        GROUP BY click_id
      `,
      query_params: {
        wid: input.workspaceId,
        start: input.start.toISOString().replace("T", " ").replace("Z", ""),
        end: input.end.toISOString().replace("T", " ").replace("Z", ""),
        clickIds: input.clickIds,
      },
      format: "JSONEachRow",
    })
    const rows = (await result.json()) as Array<{
      click_id: string
      conversions: string | number
    }>
    for (const row of rows) {
      if (!row.click_id) continue
      map.set(row.click_id, Number(row.conversions) || 0)
    }
  } catch {
    /* ClickHouse optional; attribution soft-fails */
  }
  return map
}

export async function loadNotificationCenterAnalytics(
  actorId: string,
  routeSegment: string,
  options: {
    rangeId: OverviewDateRangeId
    customRange?: DashboardCustomRange | null
    campaignId?: string | null
  }
): Promise<
  | { ok: true; data: NotificationCenterAnalyticsData }
  | { ok: false; status: number; error: string }
> {
  const landing = await getActiveLandingPageForActor(actorId, routeSegment)
  if (!landing) {
    return { ok: false, status: 404, error: "Landing page not found" }
  }

  const window = resolveNotificationCenterAnalyticsWindow(
    options.rangeId,
    new Date(),
    options.customRange,
    landing.createdAt
  )
  const campaignFilter = options.campaignId?.trim() || null

  const deliveryWhere = and(
    eq(webPushDeliveries.landingPageId, landing.id),
    or(
      timestampInRange(webPushDeliveries.sentAt, window.start, window.end),
      timestampInRange(webPushDeliveries.clickedAt, window.start, window.end),
      timestampInRange(webPushDeliveries.displayedAt, window.start, window.end),
      timestampInRange(webPushDeliveries.createdAt, window.start, window.end)
    ),
    ...(campaignFilter
      ? [eq(webPushDeliveries.campaignId, campaignFilter)]
      : [])
  )

  const [
    deliveryRows,
    campaignRows,
    activeSubCount,
    newSubsRows,
    churnedRows,
    recentDeliveryRows,
    recentSubRows,
    permissionEvents,
  ] = await Promise.all([
    db
      .select({
        id: webPushDeliveries.id,
        campaignId: webPushDeliveries.campaignId,
        subscriptionId: webPushDeliveries.subscriptionId,
        status: webPushDeliveries.status,
        scheduledFor: webPushDeliveries.scheduledFor,
        sentAt: webPushDeliveries.sentAt,
        clickedAt: webPushDeliveries.clickedAt,
        displayedAt: webPushDeliveries.displayedAt,
        dismissedAt: webPushDeliveries.dismissedAt,
        failureReason: webPushDeliveries.failureReason,
        failureCode: webPushDeliveries.failureCode,
        dripStepIndex: webPushDeliveries.dripStepIndex,
        clickId: webPushDeliveries.clickId,
        createdAt: webPushDeliveries.createdAt,
        targetUrl: webPushDeliveries.targetUrl,
      })
      .from(webPushDeliveries)
      .where(deliveryWhere),
    db
      .select({
        id: webPushCampaigns.id,
        name: webPushCampaigns.name,
        click: webPushCampaigns.click,
      })
      .from(webPushCampaigns)
      .where(eq(webPushCampaigns.landingPageId, landing.id)),
    db
      .select({ total: sql<number>`count(*)::int` })
      .from(webPushSubscriptions)
      .where(
        and(
          eq(webPushSubscriptions.landingPageId, landing.id),
          eq(webPushSubscriptions.status, "active")
        )
      ),
    db
      .select({
        id: webPushSubscriptions.id,
        createdAt: webPushSubscriptions.createdAt,
      })
      .from(webPushSubscriptions)
      .where(
        and(
          eq(webPushSubscriptions.landingPageId, landing.id),
          gte(webPushSubscriptions.createdAt, window.start),
          lt(webPushSubscriptions.createdAt, window.end)
        )
      ),
    db
      .select({
        id: webPushSubscriptions.id,
        updatedAt: webPushSubscriptions.updatedAt,
      })
      .from(webPushSubscriptions)
      .where(
        and(
          eq(webPushSubscriptions.landingPageId, landing.id),
          eq(webPushSubscriptions.status, "inactive"),
          gte(webPushSubscriptions.updatedAt, window.start),
          lt(webPushSubscriptions.updatedAt, window.end)
        )
      ),
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
      .where(
        and(
          eq(webPushDeliveries.landingPageId, landing.id),
          or(
            timestampInRange(
              webPushDeliveries.sentAt,
              window.start,
              window.end
            ),
            timestampInRange(
              webPushDeliveries.createdAt,
              window.start,
              window.end
            )
          )
        )
      )
      .orderBy(desc(webPushDeliveries.createdAt))
      .limit(40),
    db
      .select({
        id: webPushSubscriptions.id,
        endpointHash: webPushSubscriptions.endpointHash,
        status: webPushSubscriptions.status,
        origin: webPushSubscriptions.origin,
        lastSeenUrl: webPushSubscriptions.lastSeenUrl,
        createdAt: webPushSubscriptions.createdAt,
        lastEventAt: webPushSubscriptions.lastEventAt,
      })
      .from(webPushSubscriptions)
      .where(eq(webPushSubscriptions.landingPageId, landing.id))
      .orderBy(desc(webPushSubscriptions.updatedAt))
      .limit(50),
    db
      .select({
        type: webPushClientEvents.type,
        total: sql<number>`count(*)::int`,
      })
      .from(webPushClientEvents)
      .where(
        and(
          eq(webPushClientEvents.landingPageId, landing.id),
          gte(webPushClientEvents.createdAt, window.start),
          lt(webPushClientEvents.createdAt, window.end)
        )
      )
      .groupBy(webPushClientEvents.type),
  ])

  const subIds = [...new Set(deliveryRows.map((d) => d.subscriptionId))]
  const subContextRows =
    subIds.length === 0
      ? []
      : await db
          .select({
            id: webPushSubscriptions.id,
            context: webPushSubscriptions.context,
          })
          .from(webPushSubscriptions)
          .where(inArray(webPushSubscriptions.id, subIds))

  const contextBySub = new Map(
    subContextRows.map((s) => [
      s.id,
      s.context as WebPushSubscriptionContext | null,
    ])
  )
  const campaignMeta = new Map(
    campaignRows.map((c) => [
      c.id,
      {
        name: c.name,
        maskedRedirect:
          (c.click as WebPushCampaignClick | null)?.maskedRedirect !== false,
      },
    ])
  )

  let sent = 0
  let clicked = 0
  let failed = 0
  let cancelled = 0
  let queued = 0
  let displayed = 0
  let dismissed = 0
  const timeToClick: number[] = []
  const failureMap = new Map<string, number>()
  const cancelMap = new Map<string, number>()
  const campaignAgg = new Map<
    string,
    {
      sent: number
      clicked: number
      failed: number
      cancelled: number
      displayed: number
    }
  >()
  const dripAgg = new Map<string, { sent: number; clicked: number }>()
  const utmMap = new Map<string, { sent: number; clicked: number }>()
  const pathMap = new Map<string, { sent: number; clicked: number }>()
  const zipMap = new Map<string, { sent: number; clicked: number }>()
  const heatmap = new Map<string, { sent: number; clicked: number }>()
  const seriesMap = new Map<
    string,
    {
      sent: number
      clicked: number
      failed: number
      newActive: number
      churned: number
    }
  >()

  for (const key of window.dayKeys) {
    seriesMap.set(key, {
      sent: 0,
      clicked: 0,
      failed: 0,
      newActive: 0,
      churned: 0,
    })
  }

  const clickIds: string[] = []
  const warnings: string[] = []
  let unmaskedSends = 0

  for (const row of deliveryRows) {
    const camp = campaignAgg.get(row.campaignId) ?? {
      sent: 0,
      clicked: 0,
      failed: 0,
      cancelled: 0,
      displayed: 0,
    }
    const meta = campaignMeta.get(row.campaignId)
    const sentInRange =
      isSentStatus(row.status) && inWindow(row.sentAt, window.start, window.end)
    const clickedInRange =
      row.status === "clicked" &&
      inWindow(row.clickedAt, window.start, window.end)
    const failedAt = row.sentAt ?? row.createdAt
    const failedInRange =
      row.status === "failed" && inWindow(failedAt, window.start, window.end)
    const cancelledInRange =
      row.status === "cancelled" &&
      inWindow(row.createdAt, window.start, window.end)
    const queuedInRange =
      (row.status === "queued" || row.status === "sending") &&
      inWindow(row.createdAt, window.start, window.end)
    const displayedInRange = inWindow(row.displayedAt, window.start, window.end)
    const dismissedInRange = inWindow(row.dismissedAt, window.start, window.end)

    if (meta && !meta.maskedRedirect && sentInRange) {
      unmaskedSends += 1
    }

    if (displayedInRange) {
      displayed += 1
      camp.displayed += 1
    }
    if (dismissedInRange) dismissed += 1

    if (sentInRange && row.sentAt) {
      sent += 1
      camp.sent += 1
      const day = seriesBucketKey(row.sentAt, window.seriesGranularity)
      const s = seriesMap.get(day)
      if (s) s.sent += 1
      const hm = heatmap.get(weekdayHourKey(row.sentAt)) ?? {
        sent: 0,
        clicked: 0,
      }
      hm.sent += 1
      heatmap.set(weekdayHourKey(row.sentAt), hm)
    }

    if (clickedInRange && row.clickedAt) {
      clicked += 1
      camp.clicked += 1
      if (row.sentAt) {
        timeToClick.push(row.clickedAt.getTime() - row.sentAt.getTime())
      }
      const day = seriesBucketKey(row.clickedAt, window.seriesGranularity)
      const s = seriesMap.get(day)
      if (s) s.clicked += 1
      const hk = weekdayHourKey(row.clickedAt)
      const hm = heatmap.get(hk) ?? { sent: 0, clicked: 0 }
      hm.clicked += 1
      heatmap.set(hk, hm)
      if (row.clickId) clickIds.push(row.clickId)
    } else if (failedInRange) {
      failed += 1
      camp.failed += 1
      const reason =
        row.failureReason?.slice(0, 80) ||
        (row.failureCode != null ? `HTTP ${row.failureCode}` : "failed")
      failureMap.set(reason, (failureMap.get(reason) ?? 0) + 1)
      if (failedAt) {
        const day = seriesBucketKey(failedAt, window.seriesGranularity)
        const s = seriesMap.get(day)
        if (s) s.failed += 1
      }
    } else if (cancelledInRange) {
      cancelled += 1
      camp.cancelled += 1
      const ev = parseCancelEvent(row.failureReason) ?? "unknown"
      cancelMap.set(ev, (cancelMap.get(ev) ?? 0) + 1)
    } else if (queuedInRange) {
      queued += 1
    }

    if (row.dripStepIndex != null && sentInRange) {
      const stepKey = String(row.dripStepIndex)
      const d = dripAgg.get(stepKey) ?? { sent: 0, clicked: 0 }
      d.sent += 1
      if (clickedInRange) d.clicked += 1
      dripAgg.set(stepKey, d)
    }

    if (sentInRange) {
      const ctx = contextBySub.get(row.subscriptionId)
      const utmSource =
        (ctx?.utm && typeof ctx.utm === "object"
          ? (ctx.utm.utm_source ?? ctx.utm.source)
          : null) || "(none)"
      const path = ctx?.pagePath || "(none)"
      const zip = (typeof ctx?.zip === "string" && ctx.zip) || "(none)"
      const clickInc = clickedInRange ? 1 : 0
      segmentBucket(utmMap, String(utmSource), 1, clickInc)
      segmentBucket(pathMap, String(path), 1, clickInc)
      segmentBucket(zipMap, String(zip), 1, clickInc)
    }

    campaignAgg.set(row.campaignId, camp)
  }

  if (unmaskedSends > 0) {
    warnings.push(
      `${unmaskedSends} sends used unmasked click URLs — clicks are not tracked for those.`
    )
  }

  for (const row of newSubsRows) {
    const day = seriesBucketKey(row.createdAt, window.seriesGranularity)
    const s = seriesMap.get(day)
    if (s) s.newActive += 1
  }
  for (const row of churnedRows) {
    const day = seriesBucketKey(row.updatedAt, window.seriesGranularity)
    const s = seriesMap.get(day)
    if (s) s.churned += 1
  }

  // Attribution window: clicks in range, conversions within 24h after click (query wider end)
  const attributionEnd = new Date(window.end.getTime() + 24 * 60 * 60 * 1000)
  const conversionByClick = await loadAttributedConversions({
    workspaceId: landing.id,
    clickIds,
    start: window.start,
    end: attributionEnd,
  })

  let attributedConversions = 0
  const conversionsByCampaign = new Map<string, number>()
  for (const row of deliveryRows) {
    if (row.status !== "clicked" || !row.clickId) continue
    if (!inWindow(row.clickedAt, window.start, window.end)) continue
    const n = conversionByClick.get(row.clickId) ?? 0
    if (n <= 0) continue
    // one conversion credit per delivery
    attributedConversions += 1
    conversionsByCampaign.set(
      row.campaignId,
      (conversionsByCampaign.get(row.campaignId) ?? 0) + 1
    )
  }

  const campaigns: NotificationCenterCampaignAnalyticsRow[] = [
    ...campaignAgg.entries(),
  ]
    .map(([id, v]) => {
      const meta = campaignMeta.get(id)
      const conversions = conversionsByCampaign.get(id) ?? 0
      return {
        id,
        name: meta?.name ?? id,
        sent: v.sent,
        clicked: v.clicked,
        failed: v.failed,
        cancelled: v.cancelled,
        displayed: v.displayed,
        ctr: rate(v.clicked, v.sent),
        conversions,
        cvr: rate(conversions, v.clicked),
        maskedRedirect: meta?.maskedRedirect ?? true,
      }
    })
    .filter(
      (c) =>
        c.sent +
          c.clicked +
          c.failed +
          c.cancelled +
          c.displayed +
          c.conversions >
        0
    )
    .sort((a, b) => b.sent - a.sent)

  const series: NotificationCenterSeriesPoint[] = [...window.dayKeys]
    .sort((a, b) => a.localeCompare(b))
    .map((day) => {
      const v = seriesMap.get(day) ?? {
        sent: 0,
        clicked: 0,
        failed: 0,
        newActive: 0,
        churned: 0,
      }
      return {
        day,
        label: formatNcDayLabel(day, window.seriesGranularity),
        ...v,
      }
    })

  const kpis = {
    activeSubs: Number(activeSubCount[0]?.total ?? 0),
    newSubs: newSubsRows.length,
    churnedSubs: churnedRows.length,
    sent,
    clicked,
    failed,
    cancelled,
    queued,
    displayed,
    dismissed,
    ctr: rate(clicked, sent),
    engagedCtr: rate(clicked, displayed),
    failRate: rate(failed, sent + failed),
    cancelRate: rate(cancelled, cancelled + sent + failed + queued),
    medianTimeToClickMs: median(timeToClick),
    attributedConversions,
    attributedCvr: rate(attributedConversions, clicked),
  }

  void permissionEvents

  const data: NotificationCenterAnalyticsData = {
    range: {
      rangeId: window.rangeId,
      from: window.dayKeys[0] ?? dayKeyFallback(window.start),
      to:
        window.dayKeys[window.dayKeys.length - 1] ??
        dayKeyFallback(new Date(window.end.getTime() - 1)),
      start: window.start.toISOString(),
      end: window.end.toISOString(),
    },
    kpis,
    series,
    funnel: [
      {
        id: "queued",
        label: "Queued",
        value: queued + sent + failed + cancelled,
      },
      { id: "sent", label: "Sent", value: sent },
      { id: "clicked", label: "Clicked", value: clicked },
    ],
    conversionFunnel: [
      { id: "sent", label: "Sent", value: sent },
      { id: "clicked", label: "Clicked", value: clicked },
      {
        id: "converted",
        label: "Converted",
        value: attributedConversions,
      },
    ],
    failures: [...failureMap.entries()]
      .map(([key, count]) => ({ key, label: key, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 12),
    cancels: [...cancelMap.entries()]
      .map(([key, count]) => ({ key, label: key, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 12),
    campaigns,
    dripSteps: [...dripAgg.entries()]
      .map(([step, v]) => ({
        step: Number(step),
        sent: v.sent,
        clicked: v.clicked,
        ctr: rate(v.clicked, v.sent),
      }))
      .sort((a, b) => a.step - b.step),
    segments: {
      byUtmSource: toSegmentRows(utmMap),
      byPath: toSegmentRows(pathMap),
      byZip: toSegmentRows(zipMap),
    },
    heatmap: [...heatmap.entries()].map(([key, v]) => {
      const [dow, hour] = key.split(":").map(Number)
      return {
        dow: dow ?? 0,
        hour: hour ?? 0,
        sent: v.sent,
        clicked: v.clicked,
      }
    }),
    insights: buildInsights({
      kpis,
      campaigns,
      failures: [...failureMap.entries()].map(([key, count]) => ({
        key,
        count,
      })),
      cancels: [...cancelMap.entries()].map(([key, count]) => ({
        key,
        count,
      })),
    }),
    warnings,
    recentDeliveries: recentDeliveryRows.map(
      (d): NotificationCenterDelivery => ({
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
    ),
    subscriptions: recentSubRows.map(
      (s): NotificationCenterSubscription => ({
        id: s.id,
        endpointHash: s.endpointHash,
        status: s.status,
        origin: s.origin,
        lastSeenUrl: s.lastSeenUrl,
        createdAt: s.createdAt.toISOString(),
        lastEventAt: s.lastEventAt?.toISOString() ?? null,
      })
    ),
  }

  return { ok: true, data }
}

function dayKeyFallback(date: Date): string {
  const parts = getDashboardZonedParts(date)
  return `${parts.year}-${String(parts.month).padStart(2, "0")}-${String(parts.day).padStart(2, "0")}`
}
