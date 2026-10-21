let sdkInitStartedAt = 0

export function markSdkInitStarted(): void {
  if (!sdkInitStartedAt) sdkInitStartedAt = Date.now()
}

export function getSdkInitStartedAt(): number {
  return sdkInitStartedAt
}
