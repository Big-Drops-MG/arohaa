import type { ExperimentsDashboardData } from "@/features/experiments/model/experiments"
import {
  experimentVariantPerformanceRateLabel,
  experimentVariantPerformanceSubmitLabel,
} from "@/features/experiments/utils/experiment-table-columns"
import { TRAFFIC_DATE_RANGE_OPTIONS } from "@/features/traffic/model/traffic-range"

export function getExperimentsPlaceholderData(
  _landingPagePublicId: string
): ExperimentsDashboardData {
  void _landingPagePublicId

  const formType = "single" as const

  return {
    formType,
    dateRangeOptions: TRAFFIC_DATE_RANGE_OPTIONS,
    defaultDateRangeId: "7d",
    experiments: [
      {
        id: "landing-page-test",
        name: "Landing Page Test",
        status: "Running",
        variants: "A / B",
        startDate: "Apr 1",
      },
      {
        id: "cta-button-test",
        name: "CTA Button Test",
        status: "Completed",
        variants: "A / B / C",
        startDate: "Mar 20",
        highlighted: true,
      },
      {
        id: "form-layout-test",
        name: "Form Layout Test",
        status: "Running",
        variants: "A / B",
        startDate: "Apr 5",
      },
    ],
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
      rows: [
        { variant: "A", visitors: "2,000", formSubmitted: "300", fsr: "15%" },
        { variant: "B", visitors: "2,100", formSubmitted: "420", fsr: "20%" },
        { variant: "C", visitors: "1,800", formSubmitted: "250", fsr: "13%" },
      ],
    },
    performanceByLocation: {
      title: "Performance by location",
      columns: [
        { key: "city", label: "City" },
        { key: "variantA", label: "Variant A FSR" },
        { key: "variantB", label: "Variant B FSR" },
        { key: "variantC", label: "Variant C FSR" },
      ],
      rows: [
        {
          city: "New York",
          variantA: "18%",
          variantB: "25%",
          variantC: "15%",
        },
        {
          city: "Chicago",
          variantA: "14%",
          variantB: "19%",
          variantC: "12%",
        },
        {
          city: "Dallas",
          variantA: "12%",
          variantB: "15%",
          variantC: "10%",
        },
      ],
    },
    performanceByState: {
      title: "Performance by state",
      columns: [
        { key: "state", label: "State" },
        { key: "variantA", label: "Variant A FSR" },
        { key: "variantB", label: "Variant B FSR" },
        { key: "variantC", label: "Variant C FSR" },
      ],
      rows: [
        {
          state: "New York",
          variantA: "17%",
          variantB: "22%",
          variantC: "14%",
        },
        { state: "Texas", variantA: "13%", variantB: "18%", variantC: "11%" },
        { state: "Florida", variantA: "15%", variantB: "20%", variantC: "12%" },
      ],
    },
    performanceByZipcode: {
      title: "Performance by zipcode",
      columns: [
        { key: "zipcode", label: "Zipcode" },
        { key: "variantA", label: "Variant A FSR" },
        { key: "variantB", label: "Variant B FSR" },
        { key: "variantC", label: "Variant C FSR" },
      ],
      rows: [
        { zipcode: "10001", variantA: "19%", variantB: "24%", variantC: "16%" },
        { zipcode: "60601", variantA: "14%", variantB: "18%", variantC: "11%" },
        { zipcode: "75201", variantA: "12%", variantB: "16%", variantC: "9%" },
      ],
    },
    controlVariant: "A",
    mode: "data_variant",
    winnerCallout: "B leads with 20.0% FSR",
    config: null,
    siblings: [],
  }
}
