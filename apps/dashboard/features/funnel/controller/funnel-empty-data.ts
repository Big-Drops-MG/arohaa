import type { OverviewDateRangeId } from "@/features/overview/model/overview"
import { TRAFFIC_DATE_RANGE_OPTIONS } from "@/features/traffic/model/traffic-range"
import type { FunnelDashboardData } from "@/features/funnel/model/funnel"

export function getFunnelEmptyDashboardData(
  _landingPagePublicId: string,
  rangeId: OverviewDateRangeId = "7d"
): FunnelDashboardData {
  void _landingPagePublicId

  return {
    dateRangeOptions: TRAFFIC_DATE_RANGE_OPTIONS,
    defaultDateRangeId: rangeId,
    metrics: [
      { label: "Landing Page Visits", value: "0" },
      { label: "Interactions", value: "0" },
      { label: "Form Started", value: "0" },
      { label: "Form Submitted", value: "0" },
    ],
    multiStepSteps: [
      { label: "Step 1", value: "0" },
      { label: "Step 2", value: "0" },
      { label: "Step 3", value: "0" },
      { label: "Final Submit", value: "0" },
    ],
    dropOffRows: [],
  }
}
