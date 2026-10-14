export type UtmCatalogRow = {
  id: string
  key: string
  value: string
  status: "active" | "blocked"
}

export type DiscoveredUtmPair = {
  key: string
  value: string
}

/**
 * Active catalog rows that are no longer in the live discovery window.
 * Blocked rows are never pruned — they are intentional allow/deny state.
 */
export function staleActiveUtmParamIds(
  existing: UtmCatalogRow[],
  discovered: DiscoveredUtmPair[]
): string[] {
  const keep = new Set(discovered.map((row) => `${row.key}::${row.value}`))
  const stale: string[] = []
  for (const row of existing) {
    if (row.status !== "active") continue
    if (keep.has(`${row.key}::${row.value}`)) continue
    stale.push(row.id)
  }
  return stale
}
