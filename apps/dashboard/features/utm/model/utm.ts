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
  active: number
  blocked: number
  activePct: number
  blockedPct: number
}

export type UtmDashboardData = {
  brandName: string
  stats: UtmDashboardStats
  activeItems: UtmParamPair[]
  blockedItems: UtmParamPair[]
  items: UtmParamItem[]
}
