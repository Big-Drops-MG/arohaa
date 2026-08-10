export type HeatmapMode = 'click' | 'scroll' | 'attention' | 'form'
export type HeatmapDevice = 'all' | 'mobile' | 'tablet' | 'desktop'

export type HeatmapCell = {
  gridX: number
  gridY: number
  value: number
}

export type HeatmapPoint = {
  /** Page-relative X (0–1) — fallback when element cannot be resolved. */
  x: number
  /** Page-relative Y (0–1). */
  y: number
  value: number
  /** Stable CSS selector captured at click time. */
  selector?: string | null
  /** Element-relative X/Y inside the selector target (0–1). */
  ex?: number | null
  ey?: number | null
  viewportWidth?: number | null
  viewportHeight?: number | null
  documentWidth?: number | null
  documentHeight?: number | null
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

export type HeatmapField = {
  fieldName: string
  count: number
  selector: string
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
  fields: HeatmapField[]
  maxValue: number
  totalEvents: number
}
