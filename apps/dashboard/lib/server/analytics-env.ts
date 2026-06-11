import { bootstrapDashboardEnv } from "@/lib/server/env"

export const DEV_INTERNAL_API_SECRET = "dev-arohaa-internal-local"

let bootstrapped = false

export function ensureDashboardEnvLoaded(): void {
  if (bootstrapped) return
  bootstrapDashboardEnv(import.meta.url)
  bootstrapped = true
}

export function resolveInternalApiSecret(): string | undefined {
  ensureDashboardEnvLoaded()
  const secret = process.env.AROHAA_INTERNAL_API_SECRET?.trim()
  if (secret) return secret
  if (process.env.NODE_ENV === "development") return DEV_INTERNAL_API_SECRET
  return undefined
}

export function resolveIngestApiBase(): string | undefined {
  ensureDashboardEnvLoaded()
  const configured =
    process.env.INGEST_BASE_URL?.trim() ||
    process.env.NEXT_PUBLIC_AROHAA_INGEST_API_BASE?.trim()

  if (configured) return configured.replace(/\/$/, "")

  if (process.env.NODE_ENV === "development") {
    return "http://127.0.0.1:3001"
  }

  return undefined
}
