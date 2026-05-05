export interface SDKConfig {
  wid: string
  lpId: string
  page: string
  variant: string
  formtype: "zip" | "single" | "multiple"
  apiBase: string
}

export interface EventPayload {
  wid: string
  lp_id?: string
  uid: string
  sid: string
  fp: string
  ev: string
  ts: number
  url: string
  page: string
  variant: string
  formtype: "zip" | "single" | "multiple"
  utm_source: string
  utm_medium: string
  utm_campaign: string
  utm_term: string
  utm_content: string
  referrer: string
  metric_name: string
  metric_value: number
  props: Record<string, unknown>
}

export interface MetricExtension {
  metric_name: string
  metric_value: number
}

export interface Identity {
  uid: string
  sid: string
  fp: string
}
