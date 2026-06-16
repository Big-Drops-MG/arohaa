import type { FunnelDashboardData } from "@/features/funnel/model/funnel"

export function getFunnelPlaceholderData(
  _landingPagePublicId: string
): FunnelDashboardData {
  void _landingPagePublicId

  return {
    formType: "single",
    dateRangeOptions: [
      { id: "24h", label: "Last 24 hours" },
      { id: "7d", label: "Last 7 days" },
      { id: "30d", label: "Last 30 days" },
      { id: "3m", label: "Last 3 months" },
      { id: "12m", label: "Last 12 months" },
      { id: "24m", label: "Last 24 months" },
    ],
    defaultDateRangeId: "7d",
    defaultKpiMetricId: "landing-page-visits",
    metrics: [
      {
        id: "landing-page-visits",
        label: "Landing Page Visits",
        value: "8,000",
        change: "-31%",
        changeVariant: "negative",
      },
      {
        id: "interactions",
        label: "Interactions",
        value: "5,500",
        change: "-45%",
        changeVariant: "negative",
      },
      {
        id: "form-started",
        label: "Form Started",
        value: "3,000",
        change: "+5%",
        changeVariant: "positive",
      },
      {
        id: "form-submitted",
        label: "Form Submitted",
        value: "1,200",
      },
    ],
    multiStepSteps: [
      {
        label: "Step 1",
        value: "8,000",
        change: "-20%",
        changeVariant: "negative",
      },
      {
        label: "Step 2",
        value: "5,500",
        change: "-25%",
        changeVariant: "negative",
      },
      {
        label: "Step 3",
        value: "3,000",
        change: "-33%",
        changeVariant: "negative",
      },
      {
        label: "Final Submit",
        value: "1,200",
      },
    ],
    dropOffRows: [
      {
        fieldName: "Phone Number",
        emphasized: true,
        dropOffs: "800",
        percentDrop: "40%",
      },
      {
        fieldName: "Email",
        dropOffs: "500",
        percentDrop: "25%",
      },
      {
        fieldName: "ZIP Code",
        dropOffs: "300",
        percentDrop: "15%",
      },
    ],
  }
}
