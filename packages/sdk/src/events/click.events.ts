import { track } from "../core/tracker"

function resolveClickTarget(target: EventTarget | null): HTMLElement | null {
  if (!(target instanceof HTMLElement)) return null
  return target
}

export function setupClickTracking(): void {
  document.addEventListener(
    "click",
    (e) => {
      const target = resolveClickTarget(e.target)
      if (!target) return

      const anchor = target.closest("a")
      if (anchor) {
        const href = anchor.href
        if (href.startsWith("tel:")) {
          track("call_click", {
            href,
            text: anchor.innerText?.trim() || undefined,
          })
          return
        }

        track("link_click", {
          href,
          text: anchor.innerText?.trim() || undefined,
        })
        return
      }

      const button = target.closest("button")
      if (button) {
        track("button_click", { text: button.innerText?.trim() || undefined })
      }
    },
    true,
  )
}
