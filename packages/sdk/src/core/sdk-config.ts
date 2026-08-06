import { getConfig } from "../model/config"
import { setFieldBlobKeyFromB64 } from "../utils/field-blob"

export type SdkRemoteConfig = {
  heatmapSampleRate: number
  redirectPageUrl: string | null
  redirectHostname: string | null
}

let remoteConfig: SdkRemoteConfig = {
  heatmapSampleRate: 1,
  redirectPageUrl: null,
  redirectHostname: null,
}
let heatmapSampled: boolean | null = null
let configReady = false

export function getHeatmapSampleRate(): number {
  return remoteConfig.heatmapSampleRate
}

export function getRemoteRedirectPageUrl(): string | null {
  return remoteConfig.redirectPageUrl
}

export function getRemoteRedirectHostname(): string | null {
  return remoteConfig.redirectHostname
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
        redirect_page_url?: unknown
        redirect_hostname?: unknown
        ck?: unknown
      }
      const rate = Number(data.heatmap_sample_rate)
      if (Number.isFinite(rate)) {
        remoteConfig.heatmapSampleRate = Math.min(1, Math.max(0, rate))
      }
      if (typeof data.redirect_page_url === "string" && data.redirect_page_url) {
        remoteConfig.redirectPageUrl = data.redirect_page_url
      }
      if (
        typeof data.redirect_hostname === "string" &&
        data.redirect_hostname
      ) {
        remoteConfig.redirectHostname = data.redirect_hostname
      }
      if (typeof data.ck === "string") {
        setFieldBlobKeyFromB64(data.ck)
      }
    }
  } catch {
    // keep defaults
  }

  configReady = true
  void isHeatmapSessionSampled()
}
