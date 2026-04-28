import { track } from "../core/tracker"

export function setupClickTracking(): void {
  document.addEventListener("click", (e) => {
    const target = e.target as HTMLElement
    if (!target) return

    if (target.tagName === "BUTTON") {
      track("button_click", { text: target.innerText })
    }

    if (target.tagName === "A") {
      const href = (target as HTMLAnchorElement).href
      track("link_click", { href, text: target.innerText })
    }
  })
}
