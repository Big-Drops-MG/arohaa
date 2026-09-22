export function getCookie(name: string): string | undefined {
  return document.cookie
    .split("; ")
    .find((row) => row.startsWith(`${name}=`))
    ?.split("=")[1]
}

export function setCookie(name: string, value: string, days = 365): void {
  const d = new Date()
  d.setTime(d.getTime() + days * 86400000)
  const secure =
    typeof location !== "undefined" && location.protocol === "https:"
      ? "; Secure"
      : ""
  document.cookie = `${name}=${value}; path=/; expires=${d.toUTCString()}; SameSite=Lax${secure}`
}
