const STORAGE_PREFIX = "arohaa:dash"

function storageKey(projectId: string, key: string): string {
  return `${STORAGE_PREFIX}:${projectId}:${key}`
}

export function readDashboardPreference(
  projectId: string,
  key: string
): string | null {
  if (typeof window === "undefined") return null
  try {
    const value = window.localStorage.getItem(storageKey(projectId, key))
    return value && value.length > 0 ? value : null
  } catch {
    return null
  }
}

export function writeDashboardPreference(
  projectId: string,
  key: string,
  value: string
): void {
  if (typeof window === "undefined") return
  try {
    window.localStorage.setItem(storageKey(projectId, key), value)
  } catch {
    // Quota / private mode — ignore.
  }
}

export function clearDashboardPreference(projectId: string, key: string): void {
  if (typeof window === "undefined") return
  try {
    window.localStorage.removeItem(storageKey(projectId, key))
  } catch {
    // ignore
  }
}
