export function newerTimestamp(
  a: string | undefined,
  b: string | undefined,
): string {
  const left = (a || '').trim()
  const right = (b || '').trim()
  if (!left) return right
  if (!right) return left
  return left >= right ? left : right
}

export function compareSessionRecencyDesc(
  a: {
    createdAt?: string | null
    submittedAt?: string | null
    sessionId: string
  },
  b: {
    createdAt?: string | null
    submittedAt?: string | null
    sessionId: string
  },
): number {
  const at = (a.createdAt || a.submittedAt || '').trim()
  const bt = (b.createdAt || b.submittedAt || '').trim()
  if (!at && bt) return 1
  if (at && !bt) return -1
  if (at !== bt) return bt.localeCompare(at)
  return a.sessionId.localeCompare(b.sessionId)
}

export function selectReviewLeadsWithoutEvictingSeed<
  T extends {
    workspaceId: string
    sessionId: string
    createdAt?: string | null
    submittedAt?: string | null
  },
>(seed: T[], extras: T[]): T[] {
  const byKey = new Map<string, T>()
  for (const lead of seed) {
    byKey.set(`${lead.workspaceId}:${lead.sessionId}`, lead)
  }
  for (const lead of extras) {
    const key = `${lead.workspaceId}:${lead.sessionId}`
    if (byKey.has(key)) continue
    byKey.set(key, lead)
  }
  return [...byKey.values()].sort(compareSessionRecencyDesc)
}
