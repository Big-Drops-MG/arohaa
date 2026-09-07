export type UtmParamStatus = "active" | "blocked"

export type UtmParamItem = {
  key: string
  value: string
  status: UtmParamStatus
}

export type UtmParamPair = {
  key: string
  value: string
}

export type UtmDashboardStats = {
  total: number
  activeSource: number
  activeS1: number
  blockedSource: number
  blockedS1: number
}

export type UtmDashboardData = {
  brandName: string
  stats: UtmDashboardStats
  activeItems: UtmParamPair[]
  blockedItems: UtmParamPair[]
  items: UtmParamItem[]
  previewLimit?: number
  activeTruncated?: boolean
}

export function getUtmParamLabel(key: string): string {
  if (key === "utm_source") return "Source"
  if (key === "utm_s1") return "S1"
  return key
}
