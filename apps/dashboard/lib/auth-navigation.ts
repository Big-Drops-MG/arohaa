const AUTH_HISTORY_TRAP_KEY = "arohaa:auth-history-trap"

export function markAuthHistoryTrap(): void {
  if (typeof window === "undefined") return
  try {
    window.sessionStorage.setItem(AUTH_HISTORY_TRAP_KEY, "1")
  } catch {
    /* private mode / storage disabled */
  }
}

export function consumeAuthHistoryTrap(): boolean {
  if (typeof window === "undefined") return false
  try {
    const value = window.sessionStorage.getItem(AUTH_HISTORY_TRAP_KEY)
    if (value) window.sessionStorage.removeItem(AUTH_HISTORY_TRAP_KEY)
    return Boolean(value)
  } catch {
    return false
  }
}

export function replaceToAuthPath(
  path: string,
  options?: { trapBack?: boolean }
): void {
  if (typeof window === "undefined") return
  if (options?.trapBack) markAuthHistoryTrap()
  window.location.replace(path)
}

export function redirectToExternalAuth(url: string): void {
  if (typeof window === "undefined") return
  markAuthHistoryTrap()
  window.location.replace(url)
}
