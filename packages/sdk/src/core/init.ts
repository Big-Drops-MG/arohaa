import { initializeConfig } from "../model/config"
import { initIdentity } from "../model/identity"
import { installFormFetchTracking } from "../events/form-tracking"
import { setupLifecycle } from "./lifecycle"

let isSDKInitialized = false

export function initSDK(): void {
  if (isSDKInitialized) return

  const config = initializeConfig()

  if (!config.wid) {
    console.error("[arohaa] Workspace ID (data-wid) is missing")
    return
  }
  if (!config.apiBase) {
    console.error("[arohaa] API base URL (data-api) is missing")
    return
  }

  installFormFetchTracking()
  initIdentity()
  setupLifecycle()
  isSDKInitialized = true
}
