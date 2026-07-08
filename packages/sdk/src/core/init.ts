import { initializeConfig } from "../model/config"
import { initIdentity } from "../model/identity"
import { installFormFetchTracking } from "../events/form-tracking"
import { setupLifecycle } from "./lifecycle"
import { enforceUtmBlockGate } from "./utm-gate"

let isSDKInitialized = false

/** Returns true when the visitor was blocked and tracking must not start. */
export async function initSDK(): Promise<boolean> {
  if (isSDKInitialized) return false

  const config = initializeConfig()

  if (!config.wid) {
    console.error("[arohaa] Workspace ID (data-wid) is missing")
    return false
  }
  if (!config.apiBase) {
    console.error("[arohaa] API base URL (data-api) is missing")
    return false
  }

  const gated = await enforceUtmBlockGate(config)
  if (gated) return true

  installFormFetchTracking()
  initIdentity()
  setupLifecycle()
  isSDKInitialized = true
  return false
}
