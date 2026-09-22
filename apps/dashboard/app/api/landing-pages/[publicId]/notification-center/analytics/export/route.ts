import { NextResponse } from "next/server"
import { route } from "@/lib/server/route"
import { getNotificationCenterAnalyticsEmpty } from "@/features/notification-center/controller/notification-center-analytics-empty"
import { loadNotificationCenterAnalytics } from "@/lib/server/web-push-analytics"
import {
  parseDashboardCustomRange,
  parseTrafficRangeId,
} from "@/features/traffic/model/traffic-range"

function csvEscape(value: string | number | null | undefined): string {
  const raw = value == null ? "" : String(value)
  if (/[",\n]/.test(raw)) return `"${raw.replace(/"/g, '""')}"`
  return raw
}

export const GET = route(
  {
    permission: "landing_pages.read",
    actor: "read",
    tab: "notification-center",
    rateLimit: "landing",
  },
  async ({ actor, params, request }) => {
    const segment = params.publicId!
    const url = new URL(request.url)
    const rangeId = parseTrafficRangeId(url.searchParams.get("range_id"))
    const customRange =
      rangeId === "custom"
        ? parseDashboardCustomRange(
            url.searchParams.get("from"),
            url.searchParams.get("to")
          )
        : null
    const campaignId = url.searchParams.get("campaign_id")
    const kind =
      url.searchParams.get("kind") === "deliveries" ? "deliveries" : "campaigns"

    const res = await loadNotificationCenterAnalytics(actor.id, segment, {
      rangeId,
      customRange,
      campaignId,
    })
    const data = res.ok
      ? res.data
      : getNotificationCenterAnalyticsEmpty(rangeId)

    const lines: string[] = []
    if (kind === "deliveries") {
      lines.push(
        [
          "id",
          "campaign",
          "status",
          "scheduled_for",
          "sent_at",
          "clicked_at",
          "failure_reason",
          "target_url",
          "click_id",
        ].join(",")
      )
      for (const d of data.recentDeliveries) {
        lines.push(
          [
            csvEscape(d.id),
            csvEscape(d.campaignName),
            csvEscape(d.status),
            csvEscape(d.scheduledFor),
            csvEscape(d.sentAt),
            csvEscape(d.clickedAt),
            csvEscape(d.failureReason),
            csvEscape(d.targetUrl),
            csvEscape(d.clickId),
          ].join(",")
        )
      }
    } else {
      lines.push(
        [
          "campaign_id",
          "name",
          "sent",
          "clicked",
          "failed",
          "cancelled",
          "ctr",
          "conversions",
          "cvr",
          "masked_redirect",
        ].join(",")
      )
      for (const c of data.campaigns) {
        lines.push(
          [
            csvEscape(c.id),
            csvEscape(c.name),
            csvEscape(c.sent),
            csvEscape(c.clicked),
            csvEscape(c.failed),
            csvEscape(c.cancelled),
            csvEscape(c.ctr),
            csvEscape(c.conversions),
            csvEscape(c.cvr),
            csvEscape(c.maskedRedirect ? "true" : "false"),
          ].join(",")
        )
      }
    }

    const body = `${lines.join("\n")}\n`
    return new NextResponse(body, {
      status: 200,
      headers: {
        "content-type": "text/csv; charset=utf-8",
        "content-disposition": `attachment; filename="notification-${kind}-${data.range.from}-${data.range.to}.csv"`,
      },
    })
  }
)
