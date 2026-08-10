import { initializeConfig } from "../model/config"
import { initIdentity } from "../model/identity"
import { installFormFetchTracking } from "../events/form-tracking"
import { setupLifecycle } from "./lifecycle"
import { setupFrameSizeReporter } from "./frame-size"
import { loadSdkRemoteConfig } from "./sdk-config"
import { enforceUtmBlockGate } from "./utm-gate"
import {
  clearPreviewSiteState,
  isHeatmapPreview,
} from "../heatmap/preview-mode"

let isSDKInitialized = false

export function isSDKInitializedState(): boolean {
  return isSDKInitialized
}

export async function initSDK(): Promise<void> {
  if (isSDKInitialized) return
  const isPreview = isHeatmapPreview()
  if (isPreview) clearPreviewSiteState()

  const config = initializeConfig()

  if (!config.wid) {
    console.error("[arohaa] Workspace ID (data-wid) is missing")
    return
  }
  if (!config.apiBase) {
    console.error("[arohaa] API base URL (data-api) is missing")
    return
  }


  setupFrameSizeReporter()

  if (isPreview) {
    isSDKInitialized = true
    return
  }

  const blocked = await enforceUtmBlockGate(config)
  if (blocked) return

  await loadSdkRemoteConfig()

  installFormFetchTracking()
  initIdentity()
  setupLifecycle()
  isSDKInitialized = true
}
