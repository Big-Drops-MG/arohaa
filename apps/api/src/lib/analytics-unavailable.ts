export const ANALYTICS_UNAVAILABLE_STATUS = 503 as const

export const ANALYTICS_UNAVAILABLE_BODY = {
  error: 'analytics_unavailable',
  code: 'CLICKHOUSE_DOWN',
} as const
