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
  if (process.env.NODE_ENV === "production") return undefined
  if (process.env.NODE_ENV === "development") return DEV_INTERNAL_API_SECRET
  return undefined
}

export function resolveIngestApiBase(): string | undefined {
  ensureDashboardEnvLoaded()

  // Explicit server-side override always wins (prod or pointing local at a remote API).
  const explicit = process.env.INGEST_BASE_URL?.trim()
  if (explicit) return explicit.replace(/\/$/, "")

  // Local `pnpm dev` runs @workspace/api on :3001 with the latest route schemas
  // (including range_id=all_time). Prefer that over NEXT_PUBLIC_*, which often
  // points at a remote deploy that lags local API changes.
  if (process.env.NODE_ENV === "development") {
    return "http://127.0.0.1:3001"
  }

  const publicBase = process.env.NEXT_PUBLIC_AROHAA_INGEST_API_BASE?.trim()
  if (publicBase) return publicBase.replace(/\/$/, "")

  return undefined
}
