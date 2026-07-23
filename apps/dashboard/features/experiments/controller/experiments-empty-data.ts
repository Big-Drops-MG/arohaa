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
import type {
  ExperimentConfigView,
  SiblingLandingPageOption,
} from "@/lib/server/experiments-store"

export function getExperimentsEmptyDashboardData(
  _landingPagePublicId: string,
  rangeId: OverviewDateRangeId = "7d",
  formType: OverviewLandingFormType = "single",
  config: ExperimentConfigView | null = null,
  siblings: SiblingLandingPageOption[] = []
): ExperimentsDashboardData {
  void _landingPagePublicId

  return {
    formType,
    dateRangeOptions: TRAFFIC_DATE_RANGE_OPTIONS,
    defaultDateRangeId: rangeId,
    experiments: config
      ? [
          {
            id: config.id,
            name: config.name,
            status: config.status,
            variants: config.variantLabels,
            startDate: config.startDate,
            endDate: config.endDate,
            noEndDate: config.noEndDate,
          },
        ]
      : [],
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
    controlVariant: config?.controlLandingPageId
      ? (config.variants.find((v) => v.isControl)?.label ?? null)
      : null,
    mode:
      config && config.variants.length > 0 ? "multi_domain" : "data_variant",
    winnerCallout: null,
    config,
    siblings,
  }
}
