const STORAGE_PREFIX = "arohaa:dash"
const PREFERENCE_EVENT = "arohaa:dashboard-preference"

type DashboardPreferenceEventDetail = {
  projectId: string
  key: string
  value: string | null
}

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
  window.dispatchEvent(
    new CustomEvent<DashboardPreferenceEventDetail>(PREFERENCE_EVENT, {
      detail: { projectId, key, value },
    })
  )
}

export function clearDashboardPreference(projectId: string, key: string): void {
  if (typeof window === "undefined") return
  try {
    window.localStorage.removeItem(storageKey(projectId, key))
  } catch {
    // ignore
  }
  window.dispatchEvent(
    new CustomEvent<DashboardPreferenceEventDetail>(PREFERENCE_EVENT, {
      detail: { projectId, key, value: null },
    })
  )
}

export function subscribeDashboardPreference(
  projectId: string,
  key: string,
  listener: (value: string | null) => void
): () => void {
  if (typeof window === "undefined") return () => undefined
  const handlePreference = (event: Event) => {
    const detail = (event as CustomEvent<DashboardPreferenceEventDetail>).detail
    if (detail?.projectId === projectId && detail.key === key) {
      listener(detail.value)
    }
  }
  window.addEventListener(PREFERENCE_EVENT, handlePreference)
  return () => window.removeEventListener(PREFERENCE_EVENT, handlePreference)
}
