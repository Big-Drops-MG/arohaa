import { getConfig } from "../model/config"

export type SdkRemoteConfig = {
  heatmapSampleRate: number
}

let remoteConfig: SdkRemoteConfig = { heatmapSampleRate: 1 }
let heatmapSampled: boolean | null = null
let configReady = false

export function getHeatmapSampleRate(): number {
  return remoteConfig.heatmapSampleRate
}

export function isHeatmapSessionSampled(): boolean {
  if (heatmapSampled === null) {
    const rate = remoteConfig.heatmapSampleRate
    if (rate <= 0) heatmapSampled = false
    else if (rate >= 1) heatmapSampled = true
    else heatmapSampled = Math.random() < rate
  }
  return heatmapSampled
}

export function isSdkConfigReady(): boolean {
  return configReady
}

export async function loadSdkRemoteConfig(): Promise<void> {
  const { apiBase, wid } = getConfig()
  if (!apiBase || !wid) {
    configReady = true
    return
  }

  const base = apiBase.replace(/\/$/, "")
  const url = `${base}/v1/sdk-config?wid=${encodeURIComponent(wid)}`

  try {
    const response = await fetch(url, {
      method: "GET",
      credentials: "omit",
      cache: "no-store",
    })
    if (response.ok) {
      const data = (await response.json()) as {
        heatmap_sample_rate?: unknown
      }
      const rate = Number(data.heatmap_sample_rate)
      if (Number.isFinite(rate)) {
        remoteConfig = {
          heatmapSampleRate: Math.min(1, Math.max(0, rate)),
        }
      }
    }
  } catch {
    // keep default rate 1
  }

  configReady = true
  void isHeatmapSessionSampled()
}
