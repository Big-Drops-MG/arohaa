import type { ExperimentsDashboardData } from "@/features/experiments/model/experiments"
import {
  experimentVariantPerformanceRateLabel,
  experimentVariantPerformanceSubmitLabel,
} from "@/features/experiments/utils/experiment-table-columns"
import type {
  OverviewDateRangeId,
  OverviewLandingFormType,
} from "@/features/overview/model/overview"
import { TRAFFIC_DATE_RANGE_OPTIONS } from "@/features/traffic/model/traffic-range"

export function getExperimentsEmptyDashboardData(
  _landingPagePublicId: string,
  rangeId: OverviewDateRangeId = "7d",
  formType: OverviewLandingFormType = "single"
): ExperimentsDashboardData {
  void _landingPagePublicId

  return {
    formType,
    dateRangeOptions: TRAFFIC_DATE_RANGE_OPTIONS,
    defaultDateRangeId: rangeId,
    experiments: [],
    variantPerformance: {
      title: "Variant performance",
      columns: [
        { key: "variant", label: "Variant" },
        { key: "visitors", label: "Visitors" },
        {
          key: "formSubmitted",
          label: experimentVariantPerformanceSubmitLabel(formType),
        },
        { key: "fsr", label: experimentVariantPerformanceRateLabel(formType) },
      ],
      rows: [],
    },
    performanceByLocation: {
      title: "Performance by location",
      columns: [{ key: "city", label: "City" }],
      rows: [],
    },
    performanceByState: {
      title: "Performance by state",
      columns: [{ key: "state", label: "State" }],
      rows: [],
    },
    performanceByZipcode: {
      title: "Performance by zipcode",
      columns: [{ key: "zipcode", label: "Zipcode" }],
      rows: [],
    },
  }
}
