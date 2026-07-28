import type {
  ExperimentsDashboardData,
  ExperimentsTableColumn,
  ExperimentsTableRow,
  ExperimentsTableSection,
} from "@/features/experiments/model/experiments"
import {
  experimentVariantDisplayLabel,
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

/**
 * Variant rows sourced from the experiment configuration rather than analytics,
 * so every linked variant stays visible while its metrics are still empty.
 */
function variantPerformanceFromConfig(
  formType: OverviewLandingFormType,
  config: ExperimentConfigView | null
): ExperimentsTableSection {
  const rateLabel = experimentVariantPerformanceRateLabel(formType)
  const hasControl = config?.variants.some((v) => v.isControl) ?? false

  const columns: ExperimentsTableColumn[] = [
    { key: "variant", label: "Variant" },
    { key: "visitors", label: "Visitors" },
    {
      key: "formSubmitted",
      label: experimentVariantPerformanceSubmitLabel(formType),
    },
    { key: "fsr", label: rateLabel },
  ]
  if (hasControl) {
    columns.push(
      { key: "fsrLift", label: `${rateLabel} lift` },
      { key: "visitorsLift", label: "Visitors lift" }
    )
  }

  const rows: ExperimentsTableRow[] = (config?.variants ?? []).map(
    (variant) => {
      const row: ExperimentsTableRow = {
        variant: experimentVariantDisplayLabel(variant.label),
        visitors: "0",
        formSubmitted: "0",
        fsr: "0.0%",
      }
      if (hasControl) {
        row.fsrLift = variant.isControl ? "Control" : "—"
        row.visitorsLift = variant.isControl ? "Control" : "—"
      }
      return row
    }
  )

  return { title: "Variant performance", columns, rows }
}

export function getExperimentsEmptyDashboardData(
  _landingPagePublicId: string,
  rangeId: OverviewDateRangeId = "7d",
  formType: OverviewLandingFormType = "single",
  config: ExperimentConfigView | null = null,
  siblings: SiblingLandingPageOption[] = []
): ExperimentsDashboardData {
  void _landingPagePublicId

  const controlLabel = config?.variants.find((v) => v.isControl)?.label ?? null

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
    variantPerformance: variantPerformanceFromConfig(formType, config),
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
    controlVariant: controlLabel
      ? experimentVariantDisplayLabel(controlLabel)
      : null,
    mode:
      config && config.variants.length > 0 ? "multi_domain" : "data_variant",
    winnerCallout: null,
    config,
    siblings,
  }
}
