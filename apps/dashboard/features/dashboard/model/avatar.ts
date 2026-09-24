/** Same-origin avatar proxy path (safe for client components). */
export function avatarProxyPath(userId: string): string {
  return `/api/avatars/${encodeURIComponent(userId)}`
}
