export type HeatmapMode = 'click' | 'scroll' | 'attention'
export type HeatmapDevice = 'all' | 'mobile' | 'tablet' | 'desktop'

export type HeatmapCell = {
  gridX: number
  gridY: number
  value: number
}

export type HeatmapPoint = {
  x: number
  y: number
  value: number
}

export type HeatmapScrollBucket = {
  bucket: number
  value: number
}

export type HeatmapSection = {
  selector: string
  dwellMs: number
  views: number
}

export type AnalyticsHeatmapResponse = {
  rangeId: string
  mode: HeatmapMode
  device: HeatmapDevice
  pageUrl: string | null
  pageUrls: string[]
  cells: HeatmapCell[]
  points: HeatmapPoint[]
  scrollBuckets: HeatmapScrollBucket[]
  sections: HeatmapSection[]
  maxValue: number
  totalEvents: number
}
