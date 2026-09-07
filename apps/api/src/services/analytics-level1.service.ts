import { formatAnalyticsHourWindow } from '../lib/analytics-timezone.js'
import { chToHour } from '../lib/analytics-timezone.js'
import type { AnalyticsInsights, Level1Stat } from '../types/analytics-insights.js'
import {
  LEAD_EVENT,
  n,
  queryJson,
  type InsightsQueryCtx,
} from './analytics-insights.service.js'

type Ctx = InsightsQueryCtx

export async function level1Insights(ctx: Ctx): Promise<AnalyticsInsights> {
  const byHour = await queryJson<{ hour: string; submissions: string }>(
    `
    SELECT
      ${chToHour('created_at')} AS hour,
      countIf(${LEAD_EVENT}) AS submissions
    FROM events_raw
    WHERE ${ctx.where}
    GROUP BY hour
    ORDER BY submissions DESC, hour ASC
    `,
    ctx.p,
  )

  let bestHour = -1
  let bestSubmissions = 0
  for (const row of byHour) {
    const hour = n(row.hour)
    const submissions = n(row.submissions)
    if (submissions > bestSubmissions) {
      bestHour = hour
      bestSubmissions = submissions
    }
  }

  const bestTimeStat: Level1Stat = {
    id: 'best-time',
    label: 'Best Time',
    value:
      bestSubmissions > 0 && bestHour >= 0
        ? formatAnalyticsHourWindow(bestHour)
        : '—',
    metricLabel: 'Form submissions',
    metricValue: bestSubmissions,
    enoughData: bestSubmissions > 0,
  }

  return {
    section: 'level1',
    kpis: [],
    charts: [],
    level1Stats: [bestTimeStat],
  }
}
