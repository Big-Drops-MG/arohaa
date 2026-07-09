import { initializeConfig } from "../model/config"
import { initIdentity } from "../model/identity"
import { installFormFetchTracking } from "../events/form-tracking"
import { setupLifecycle } from "./lifecycle"
import { runUtmGuard } from "./utm-guard"

let isSDKInitialized = false

export function isSDKInitializedState(): boolean {
  return isSDKInitialized
}

export async function initSDK(): Promise<void> {
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

  const guardResult = await runUtmGuard(config)
  if (guardResult !== "allow") return

  installFormFetchTracking()
  initIdentity()
  setupLifecycle()
  isSDKInitialized = true
}
