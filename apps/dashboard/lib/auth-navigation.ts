const AUTH_HISTORY_TRAP_KEY = "arohaa:auth-history-trap"
const AUTH_HISTORY_FLOOR_KEY = "arohaa:auth-history-floor"

export type AuthHistoryTrapTarget = "login" | "app"

export function markAuthHistoryTrap(target: AuthHistoryTrapTarget): void {
  if (typeof window === "undefined") return
  try {
    window.sessionStorage.setItem(AUTH_HISTORY_TRAP_KEY, target)
  } catch {
    /* private mode / storage disabled */
  }
}

export function consumeAuthHistoryTrap(target: AuthHistoryTrapTarget): boolean {
  if (typeof window === "undefined") return false
  try {
    if (window.sessionStorage.getItem(AUTH_HISTORY_TRAP_KEY) !== target) {
      return false
    }
    window.sessionStorage.removeItem(AUTH_HISTORY_TRAP_KEY)
    return true
  } catch {
    return false
  }
}

export function setAuthHistoryFloor(path: string): void {
  if (typeof window === "undefined") return
  try {
    window.sessionStorage.setItem(AUTH_HISTORY_FLOOR_KEY, path)
  } catch {
    /* private mode / storage disabled */
  }
}

export function getAuthHistoryFloor(): string | null {
  if (typeof window === "undefined") return null
  try {
    return window.sessionStorage.getItem(AUTH_HISTORY_FLOOR_KEY)
  } catch {
    return null
  }
}

export function replaceToAuthPath(
  path: string,
  options?: { trapBack?: AuthHistoryTrapTarget }
): void {
  if (typeof window === "undefined") return
  if (options?.trapBack) markAuthHistoryTrap(options.trapBack)
  window.location.replace(path)
}

export function redirectToExternalAuth(url: string): void {
  if (typeof window === "undefined") return
  markAuthHistoryTrap("app")
  window.location.replace(url)
}
