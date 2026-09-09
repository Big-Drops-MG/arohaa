export function replaceToAuthPath(path: string): void {
  if (typeof window === "undefined") return
  window.location.replace(path)
}
