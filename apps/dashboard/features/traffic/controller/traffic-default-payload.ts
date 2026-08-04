import type { OverviewLandingFormType } from "@/features/overview/model/overview"
import {
  conversionRateLabel,
  conversionSubmittedColumnLabel,
  hasConversionMetrics,
} from "@/features/overview/model/overview"
import { TRAFFIC_RANGE_IDS } from "@/features/traffic/model/traffic-range"
import type {
  TrafficBreakdownTable,
  TrafficSourcesData,
  TrafficTabTables,
  TrafficTablesByDateRange,
} from "@/features/traffic/model/traffic"

export function trafficFormSubmittedLabel(
  formType: OverviewLandingFormType
): string {
  return conversionSubmittedColumnLabel(formType)
}

export function trafficRateLabel(formType: OverviewLandingFormType): string {
  return conversionRateLabel(formType)
}

export function trafficTableColumns(formType: OverviewLandingFormType): {
  byTime: TrafficBreakdownTable["columns"]
  byLocation: TrafficBreakdownTable["columns"]
  byDevice: TrafficBreakdownTable["columns"]
  referrers: TrafficBreakdownTable["columns"]
  utmParameters: TrafficBreakdownTable["columns"]
  topPages: TrafficBreakdownTable["columns"]
} {
  const showForm = hasConversionMetrics(formType)
  const formSubmitted = trafficFormSubmittedLabel(formType)
  const rate = trafficRateLabel(formType)

  return {
    byTime: [
      { id: "date", label: "Date" },
      { id: "visitors", label: "Visitors", align: "right" },
      { id: "sessions", label: "Sessions", align: "right" },
      ...(showForm
        ? [
            {
              id: "formSubmitted" as const,
              label: formSubmitted,
              align: "right" as const,
            },
          ]
        : []),
    ],
    byLocation: [
      { id: "city", label: "City" },
      { id: "visitors", label: "Visitors", align: "right" },
      ...(showForm
        ? [
            {
              id: "formSubmitted" as const,
              label: formSubmitted,
              align: "right" as const,
            },
            { id: "rate" as const, label: rate, align: "right" as const },
          ]
        : []),
    ],
    byDevice: [
      { id: "device", label: "Device" },
      { id: "visitors", label: "Visitors", align: "right" },
      ...(showForm
        ? [
            {
              id: "formSubmitted" as const,
              label: formSubmitted,
              align: "right" as const,
            },
            { id: "rate" as const, label: rate, align: "right" as const },
          ]
        : []),
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

const RANGE_IDS = TRAFFIC_RANGE_IDS

export function defaultTrafficTablesByDateRange(
  formType: OverviewLandingFormType
): TrafficTablesByDateRange {
  const tables = defaultTrafficTabTables(formType)
  return Object.fromEntries(
    RANGE_IDS.map((id) => [id, tables])
  ) as TrafficTablesByDateRange
}
