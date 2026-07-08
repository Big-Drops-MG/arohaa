import type { ExperimentsDashboardData } from "@/features/experiments/model/experiments"
import {
  experimentVariantPerformanceRateLabel,
  experimentVariantPerformanceSubmitLabel,
} from "@/features/experiments/utils/experiment-table-columns"
import type {
  OverviewDateRangeId,
  OverviewLandingFormType,
} from "@/features/overview/model/overview"

export function getExperimentsEmptyDashboardData(
  _landingPagePublicId: string,
  rangeId: OverviewDateRangeId = "7d",
  formType: OverviewLandingFormType = "single"
): ExperimentsDashboardData {
  void _landingPagePublicId

  return {
    formType,
    dateRangeOptions: [
      { id: "24h", label: "Last 24 hours" },
      { id: "7d", label: "Last 7 days" },
      { id: "30d", label: "Last 30 days" },
      { id: "3m", label: "Last 3 months" },
      { id: "12m", label: "Last 12 months" },
      { id: "24m", label: "Last 24 months" },
    ],
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
