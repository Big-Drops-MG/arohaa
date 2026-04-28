import { getConfig } from "../model/config"
import { initIdentity } from "../model/identity"
import { setupLifecycle } from "./lifecycle"

export function initSDK(): void {
  const config = getConfig()

  if (!config.wid) {
    console.error("[arohaa] Workspace ID (data-wid) is missing")
    return
  }

  initIdentity()
  setupLifecycle()
}
