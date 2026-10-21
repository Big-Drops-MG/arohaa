import { initializeConfig } from "../model/config"
import { initIdentity } from "../model/identity"
import { startSessionTokenRefresh } from "../model/session-token"
import { setupLifecycle } from "./lifecycle"
import { setupFrameSizeReporter } from "./frame-size"
import { loadSdkRemoteConfig } from "./sdk-config"
import { enforceUtmBlockGate } from "./utm-gate"
import {
  clearPreviewSiteState,
  isHeatmapPreview,
} from "../heatmap/preview-mode"
import { markSdkInitStarted } from "./init-timing"

let isSDKInitialized = false

export function isSDKInitializedState(): boolean {
  return isSDKInitialized
}

export async function initSDK(): Promise<void> {
  if (isSDKInitialized) return
  markSdkInitStarted()
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

  initIdentity()
  startSessionTokenRefresh()
  setupLifecycle()
  isSDKInitialized = true
}
