import type { OverviewLandingFormType } from "@/features/overview/model/overview"
import type {
  TrafficBreakdownTable,
  TrafficSourcesData,
  TrafficTabTables,
  TrafficTablesByDateRange,
} from "@/features/traffic/model/traffic"

function formSubmittedLabel(formType: OverviewLandingFormType): string {
  return formType === "zip" ? "Zip Submitted" : "Form Submitted"
}

function rateLabel(formType: OverviewLandingFormType): string {
  return formType === "zip" ? "ZSR" : "FSR"
}

export function trafficTableColumns(formType: OverviewLandingFormType): {
  byTime: TrafficBreakdownTable["columns"]
  byLocation: TrafficBreakdownTable["columns"]
  byDevice: TrafficBreakdownTable["columns"]
  referrers: TrafficBreakdownTable["columns"]
  utmParameters: TrafficBreakdownTable["columns"]
  topPages: TrafficBreakdownTable["columns"]
} {
  const formSubmitted = formSubmittedLabel(formType)
  const rate = rateLabel(formType)

  return {
    byTime: [
      { id: "date", label: "Date" },
      { id: "visitors", label: "Visitors", align: "right" },
      { id: "sessions", label: "Sessions", align: "right" },
      { id: "formSubmitted", label: formSubmitted, align: "right" },
    ],
    byLocation: [
      { id: "city", label: "City" },
      { id: "visitors", label: "Visitors", align: "right" },
      { id: "formSubmitted", label: formSubmitted, align: "right" },
      { id: "rate", label: rate, align: "right" },
    ],
    byDevice: [
      { id: "device", label: "Device" },
      { id: "visitors", label: "Visitors", align: "right" },
      { id: "formSubmitted", label: formSubmitted, align: "right" },
      { id: "rate", label: rate, align: "right" },
    ],
    referrers: [
      { id: "source", label: "Referrer" },
      { id: "visitors", label: "Visitors", align: "right" },
    ],
    utmParameters: [
      { id: "parameter", label: "Parameter" },
      { id: "visitors", label: "Visitors", align: "right" },
    ],
    topPages: [
      { id: "page", label: "Pages" },
      { id: "visitors", label: "Visitors", align: "right" },
    ],
  }
}

function emptyTable(
  columns: TrafficBreakdownTable["columns"]
): TrafficBreakdownTable {
  return { columns, rows: [] }
}

export function defaultTrafficTabTables(
  formType: OverviewLandingFormType
): TrafficTabTables {
  const cols = trafficTableColumns(formType)
  const sources: TrafficSourcesData = {
    referrers: emptyTable(cols.referrers),
    utmParameters: emptyTable(cols.utmParameters),
  }

  return {
    byTime: emptyTable(cols.byTime),
    byLocation: emptyTable(cols.byLocation),
    byDevice: emptyTable(cols.byDevice),
    sources,
    topPages: emptyTable(cols.topPages),
  }
}

const RANGE_IDS = ["24h", "7d", "30d", "3m", "12m", "24m"] as const

export function defaultTrafficTablesByDateRange(
  formType: OverviewLandingFormType
): TrafficTablesByDateRange {
  const tables = defaultTrafficTabTables(formType)
  return Object.fromEntries(
    RANGE_IDS.map((id) => [id, tables])
  ) as TrafficTablesByDateRange
}
