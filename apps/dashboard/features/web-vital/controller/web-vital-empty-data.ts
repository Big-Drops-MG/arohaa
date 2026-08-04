import type { OverviewDateRangeId } from "@/features/overview/model/overview"
import type { WebVitalDashboardData } from "@/features/web-vital/model/web-vital"
import { TRAFFIC_DATE_RANGE_OPTIONS } from "@/features/traffic/model/traffic-range"

export function getWebVitalEmptyDashboardData(
  _projectId: string,
  rangeId: OverviewDateRangeId = "7d"
): WebVitalDashboardData {
  return {
    dateRangeOptions: TRAFFIC_DATE_RANGE_OPTIONS,
    defaultDateRangeId: rangeId,
    lighthouseScore: null,
    metrics: [
      {
        name: "LCP",
        p75: 0,
        avg: 0,
        samples: 0,
        rating: "none",
        score: 0,
        unit: "ms",
      },
      {
        name: "CLS",
        p75: 0,
        avg: 0,
        samples: 0,
        rating: "none",
        score: 0,
        unit: "unitless",
      },
      {
        name: "INP",
        p75: 0,
        avg: 0,
        samples: 0,
        rating: "none",
        score: 0,
        unit: "ms",
      },
    ],
    devices: [],
    states: [],
    totalSamples: 0,
  }
}
