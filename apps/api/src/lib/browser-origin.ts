export function hasBrowserOriginOrReferer(headers: {
  origin?: string | string[] | undefined
  referer?: string | string[] | undefined
  referrer?: string | string[] | undefined
}): boolean {
  const origin = Array.isArray(headers.origin)
    ? headers.origin[0]
    : headers.origin
  if (typeof origin === 'string' && origin.trim()) return true

  const referer = Array.isArray(headers.referer)
    ? headers.referer[0]
    : headers.referer
  if (typeof referer === 'string' && referer.trim()) return true

  const referrer = Array.isArray(headers.referrer)
    ? headers.referrer[0]
    : headers.referrer
  if (typeof referrer === 'string' && referrer.trim()) return true

  return false
}
