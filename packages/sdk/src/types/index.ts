export interface SDKConfig {
  wid: string
  page: string
  variant: string
  formtype: "zip" | "single" | "multiple"
  apiBase: string
}

export interface EventPayload {
  wid: string
  uid: string | undefined
  sid: string | undefined
  ev: string
  ts: number
  url: string
  page: string
  variant: string
  formtype: "zip" | "single" | "multiple"
  props: Record<string, unknown>
}

export interface Identity {
  uid: string
  sid: string
}
