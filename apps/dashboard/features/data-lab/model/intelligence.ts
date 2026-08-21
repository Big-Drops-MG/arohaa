export type IntelligenceWinner = {
  id: string
  label: string
  value: string
  metricLabel: string
  metricValue: number
  secondaryLabel?: string
  secondaryValue?: number | string
  sampleSize: number
  enoughData: boolean
}

export type IntelligenceBoardRow = {
  label: string
  values: Record<string, string | number>
}

export type IntelligenceBoard = {
  id: string
  title: string
  columns: { key: string; label: string }[]
  rows: IntelligenceBoardRow[]
  takeaway: string
}

export type IntelligenceCenterPayload = {
  section: "intelligence"
  winners: IntelligenceWinner[]
  boards: IntelligenceBoard[]
  actions: string[]
}
