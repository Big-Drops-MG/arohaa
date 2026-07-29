export type SegmentOperator =
  | "equals"
  | "not_equals"
  | "contains"
  | "not_contains"
  | "in"
  | "not_in"
  | "greater_than"
  | "less_than"

export type SegmentRule = {
  column: string
  operator: SegmentOperator
  value: string | number | (string | number)[]
}

export type SegmentGroup = {
  operator: "and" | "or"
  rules: (SegmentRule | SegmentGroup)[]
}

export const AVAILABLE_COLUMNS = [
  { id: "source", label: "UTM Source" },
  { id: "medium", label: "UTM Medium" },
  { id: "campaign", label: "UTM Campaign" },
  { id: "city", label: "City" },
  { id: "country", label: "Country" },
  { id: "device", label: "Device Type" },
  { id: "browser", label: "Browser" },
  { id: "os", label: "Operating System" },
  { id: "event", label: "Event Name" },
  { id: "path", label: "Page URL" },
]

export const AVAILABLE_OPERATORS = [
  { id: "equals", label: "Equals" },
  { id: "not_equals", label: "Does not equal" },
  { id: "contains", label: "Contains" },
  { id: "not_contains", label: "Does not contain" },
  { id: "in", label: "Is one of" },
  { id: "not_in", label: "Is not one of" },
]
