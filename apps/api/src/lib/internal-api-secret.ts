export const DEV_INTERNAL_API_SECRET = 'dev-arohaa-internal-local'

export function resolveInternalApiSecret(): string | undefined {
  const secret = process.env.AROHAA_INTERNAL_API_SECRET?.trim()
  if (secret) return secret
  if (process.env.NODE_ENV === 'development') return DEV_INTERNAL_API_SECRET
  return undefined
}

export function verifyInternalApiRequest(
  incoming: string | string[] | undefined,
): boolean {
  const secret = resolveInternalApiSecret()
  if (!secret) return false
  const header = Array.isArray(incoming) ? incoming[0] : incoming
  return header === secret
}
