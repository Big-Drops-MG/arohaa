export const SDK_VERSION =
  typeof process !== "undefined" && process.env.SDK_VERSION
    ? process.env.SDK_VERSION
    : "1.1.0"

export const SDK_CAPABILITY = {
  fi: "fi",
  sessionToken: "session_token",
  seq: "seq",
  browserObs: "browser_obs",
  pageIntegrity: "page_integrity",
} as const

export type SdkCapability =
  (typeof SDK_CAPABILITY)[keyof typeof SDK_CAPABILITY]

const enabled = new Set<SdkCapability>([
  SDK_CAPABILITY.fi,
  SDK_CAPABILITY.sessionToken,
  SDK_CAPABILITY.seq,
  SDK_CAPABILITY.browserObs,
])

export function enableSdkCapability(cap: SdkCapability): void {
  enabled.add(cap)
}

export function getSdkCapabilities(): SdkCapability[] {
  return [...enabled]
}

export function getSdkCapabilitiesCsv(): string {
  return getSdkCapabilities().join(",")
}
