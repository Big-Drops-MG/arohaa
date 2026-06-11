export function isClickHouseUnavailableError(err: unknown): boolean {
  if (!err || typeof err !== 'object') return false

  const error = err as {
    code?: string
    errno?: number
    message?: string
  }

  if (
    error.code === 'ECONNRESET' ||
    error.code === 'ECONNREFUSED' ||
    error.code === 'ETIMEDOUT' ||
    error.errno === -4077
  ) {
    return true
  }

  const message = error.message ?? ''
  return (
    message.includes('ECONNRESET') ||
    message.includes('ECONNREFUSED') ||
    message.includes('ETIMEDOUT') ||
    message.includes('ClickHouse') ||
    message.includes('CLICKHOUSE_URL is not configured')
  )
}
