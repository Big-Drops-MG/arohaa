import { getConfig } from "../model/config"
import { getStoredEndpoint, postWebPushProxyEvent } from "./web-push-bridge"

/**
 * When the SDK snippet sets data-web-push-proxy (e.g. "/api/push"),
 * mirror visibility into the LP proxy so Arohaa abandon/cancel campaigns fire.
 * Permission + subscribe stay on the LP (@workspace/lp-core useWebPush).
 */
export function setupWebPushLifecycleBridge(): void {
  const { webPushProxy, wid, lpId } = getConfig()
  if (!webPushProxy) return

  const send = (event: string) => {
    void postWebPushProxyEvent({
      proxyBase: webPushProxy,
      event,
      subscriptionEndpoint: getStoredEndpoint(),
      wid: wid || undefined,
      lpId: lpId || undefined,
    })
  }

  document.addEventListener("visibilitychange", () => {
    send(document.visibilityState === "hidden" ? "page_hidden" : "page_visible")
  })

  window.addEventListener("pagehide", () => {
    send("page_unload")
  })
}
