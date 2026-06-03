export type FunnelChangeVariant = "positive" | "negative" | "neutral"

export type FunnelStep = {
  label: string
  value: string
  change?: string
  changeVariant?: FunnelChangeVariant
}

export type FunnelFieldDropOff = {
  fieldName: string
  dropOffs: string
  dropPercent: string
}
