const NETWORK_CODES = new Set([
  'ECONNRESET',
  'ECONNREFUSED',
  'ETIMEDOUT',
  'ENOTFOUND',
  'EAI_AGAIN',
  'EHOSTUNREACH',
  'ENETUNREACH',
  'UND_ERR_CONNECT_TIMEOUT',
  'UND_ERR_SOCKET',
])

function collectErrorText(err: unknown, depth = 0): string {
  if (!err || depth > 4) return ''
  if (typeof err === 'string') return err
  if (typeof err !== 'object') return ''

  const error = err as {
    code?: string
    message?: string
    cause?: unknown
    errors?: unknown[]
  }

  const parts = [error.code, error.message, collectErrorText(error.cause, depth + 1)]
  if (Array.isArray(error.errors)) {
    for (const nested of error.errors) {
      parts.push(collectErrorText(nested, depth + 1))
    }
  }
  return parts.filter(Boolean).join(' ')
}

/** True when analytics should fall back to empty payloads instead of 500. */
export function isClickHouseUnavailableError(err: unknown): boolean {
  if (!err || typeof err !== 'object') return false

  const error = err as {
    code?: string
    errno?: number
  }

  if (error.code && NETWORK_CODES.has(error.code)) return true
  if (error.errno === -4077) return true

  const text = collectErrorText(err)
  return (
    text.includes('ECONNRESET') ||
    text.includes('ECONNREFUSED') ||
    text.includes('ETIMEDOUT') ||
    text.includes('ENOTFOUND') ||
    text.includes('EAI_AGAIN') ||
    text.includes('getaddrinfo') ||
    text.includes('ClickHouse') ||
    text.includes('CLICKHOUSE_URL is not configured') ||
    text.includes('fetch failed')
  )
}
