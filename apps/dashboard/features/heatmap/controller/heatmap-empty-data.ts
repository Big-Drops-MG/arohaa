import type {
  HeatmapDashboardData,
  HeatmapDevice,
  HeatmapMode,
} from "@/features/heatmap/model/heatmap"
import type { OverviewDateRangeId } from "@/features/overview/model/overview"
import { TRAFFIC_DATE_RANGE_OPTIONS } from "@/features/traffic/model/traffic-range"

export function getHeatmapEmptyDashboardData(
  _landingPagePublicId: string,
  rangeId: OverviewDateRangeId = "7d",
  mode: HeatmapMode = "click",
  device: HeatmapDevice = "desktop"
): HeatmapDashboardData {
  void _landingPagePublicId

  return {
    dateRangeOptions: TRAFFIC_DATE_RANGE_OPTIONS,
    defaultDateRangeId: rangeId,
    mode,
    device,
    pageUrl: null,
    pageUrls: [],
    cells: [],
    points: [],
    scrollBuckets: [],
    sections: [],
    maxValue: 0,
    totalEvents: 0,
    opacity: 0.65,
  }
}
